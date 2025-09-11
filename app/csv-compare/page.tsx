"use client";

import React, { useState, useCallback } from "react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { uploadWarehouseCsv } from "@/app/wb/actions";
import { useAppContext } from "@/contexts/AppContext";

interface InventoryItem {
    id: string;
    quantity: number;
}

// Define a more specific type for your CSV data
interface CsvRow {
    Артикул: string;
    Количество: string;
    [key: string]: string; // Allow other columns
}

const CSVCompare = () => {
    const [csv1, setCsv1] = useState("");
    const [csv2, setCsv2] = useState("");
    const [inventory1, setInventory1] = useState<InventoryItem[]>([]);
    const [inventory2, setInventory2] = useState<InventoryItem[]>([]);
    const [differences, setDifferences] = useState<string[]>([]);
    const [hideZeroQuantity, setHideZeroQuantity] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [popularItems, setPopularItems] = useState<any[]>([]);
    const [diffCounts, setDiffCounts] = useState<{ [id: string]: number }>({});
    const { user } = useAppContext();

    const parseCSV = useCallback(
        (csvText: string, setInventory: (items: InventoryItem[]) => void) => {
            parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const inventoryMap: { [id: string]: number } = {};

                    results.data.forEach((row: any) => {
                        const id = row["id"];
                        let quantity = 0;
                        try {
                            const specs = JSON.parse(row["specs"]);
                            if (specs && specs.warehouse_locations) {
                                if (Array.isArray(specs.warehouse_locations)) {
                                    specs.warehouse_locations.forEach(
                                        (location: { quantity: string | number }) => {
                                            quantity += parseInt(location.quantity.toString(), 10) || 0;
                                        }
                                    );
                                }
                            }
                        } catch (e) {
                            // if specs is not an JSON, try to parse value from row.quantity, example: row["warehouse_locations"]
                            try {

                                if (row["warehouse_locations"]) {
                                    quantity = parseInt(row["warehouse_locations"].toString(), 10) || 0;
                                } 
}catch (ee: any) {
            toast.error(ee?.message || "Error during upload.");
            console.error("Upload Error:", ee);
            
            
                            }
                        }

                        if (id) {
                            inventoryMap[id] = (inventoryMap[id] || 0) + quantity;
                        }
                    });

                    const inventoryList: InventoryItem[] = Object.entries(inventoryMap).map(
                        ([id, quantity]) => ({
                            id,
                            quantity,
                        })
                    );

                    setInventory(inventoryList);
                },
                error: (error) => {
                    console.error("CSV parsing error:", error);
                    alert("Error parsing CSV. Check console for details.");
                },
            });
        },
        []
    );

    const compareInventories = useCallback(() => {
        const id1 = new Set(inventory1.map((i) => i.id));
        const id2 = new Set(inventory2.map((i) => i.id));

        const addedItems = [...id2].filter((id) => !id1.has(id));
        const removedItems = [...id1].filter((id) => !id2.has(id));
        const modifiedItems = [...id1].filter((id) => id2.has(id));

        const diffs: string[] = [];
        const diffCounts: { [id: string]: number } = {};

        if (addedItems.length > 0) {
            diffs.push(`Added items: ${addedItems.join(", ")}`);
        }
        if (removedItems.length > 0) {
            diffs.push(`Removed items: ${removedItems.join(", ")}`);
        }

        modifiedItems.forEach((id) => {
            const item1 = inventory1.find((i) => i.id === id);
            const item2 = inventory2.find((i) => i.id === id);
            const qty1 = item1?.quantity || 0;
            const qty2 = item2?.quantity || 0;
            const diff = qty2 - qty1;
            if (diff !== 0) {
                diffs.push(`${id}: ${qty1} -> ${qty2} (Diff: ${diff})`);
                diffCounts[id] = diff; // Store the difference
            }
        });

        setDifferences(diffs);
        setDiffCounts(diffCounts); // Update diffCounts state

        // Basic analytics: Most popular items (example)
        const allItems = [...inventory1, ...inventory2];
        const itemCount: { [id: string]: number } = {};

        allItems.forEach((item) => {
            itemCount[item.id] = (itemCount[item.id] || 0) + item.quantity;
        });

        const sortedItems = Object.entries(itemCount)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 13) // Top 13
            .map(([id, count]) => ({ id, count }));
        setPopularItems(sortedItems);
    }, [inventory1, inventory2]);

    const handleCsv1Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCsv1 = e.target.value;
        setCsv1(newCsv1);
        parseCSV(newCsv1, setInventory1);
    };

    const handleCsv2Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCsv2 = e.target.value;
        setCsv2(newCsv2);
        parseCSV(newCsv2, setInventory2);
    };

    const inventoryToCsv = (
        inventory: InventoryItem[],
        includeZeroQuantities: boolean = false
    ): string => {
        const csvData = inventory
            .filter((item) => includeZeroQuantities || item.quantity > 0) // Apply filter
            .map((item) => ({
                Артикул: item.id,
                Количество: item.quantity,
            }));
        return unparse(csvData, {
            header: true,
            quotes: true,
        });
    };

    const handleUploadToSupabase = useCallback(async () => {
        setUploading(true);
        try {
            const csvData = csv2;  // Directly using the CSV 2 content
            if (!csvData.trim()) {
                toast.error("No data to upload.");
                return;
            }
            const cleanCsvData = csvData.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width spaces and BOM

            // Define processData inside the useCallback to ensure it's created before parse
            const processData = async (data: CsvRow[]) => {
                const BATCH_SIZE = 13;
                const rows = data;

                for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                    const batch = rows.slice(i, i + BATCH_SIZE);
                   //** CRITICAL AWAIT **//
                    const result = await uploadWarehouseCsv(batch, user?.id);

                    if (!result.success) {
                        toast.error(result.error || "Failed to upload batch to Supabase.");
                        setUploading(false);
                        return;
                    } else {
                        console.log(
                            `Uploaded batch ${i / BATCH_SIZE + 1}/${Math.ceil(
                                rows.length / BATCH_SIZE
                            )}`
                        );
                    }
                }

                toast.success("All data uploaded to Supabase!");
                setUploading(false); // Set uploading to false only after successful completion
            };

            // Parse the CSV data using PapaParse
            const parsedCsv = parse<CsvRow>(cleanCsvData, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false, // Important for avoiding type conversion issues
                quoteChar: '"', // Specify the quote character
                escapeChar: '\\', // Specify the escape character
                strict: false, // Disable strict mode to handle malformed quotes
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn("CSV Parsing Errors:", results.errors);  // Log ALL errors

                        // Attempt to recover:  Filter out rows with errors.  This MIGHT lose data.
                        const validData = results.data.filter((row, index) => {
                            return !results.errors.some(err => err.row === index);
                        });

                        if (validData.length === 0) {
                            toast.error("No valid data after error recovery.");
                            setUploading(false);
                            return;
                        }

                        // Proceed with `validData` instead of `results.data`
                        processData(validData); // Call function to process the (potentially) filtered data.
                    } else {
                        processData(results.data);  // No errors, proceed as normal
                    }
                },
                error: (error) => {
                    console.error("CSV parsing error:", error);
                    toast.error(`CSV Parsing Error: ${error.message}`);
                    setUploading(false);
                }
            });
        } catch (err: any) {
            toast.error(err?.message || "Error during upload.");
            console.error("Upload Error:", err);
            setUploading(false);
        }
    }, [csv2, user, uploadWarehouseCsv, toast]); // Add dependencies for useCallback

    const filteredInventory1 = hideZeroQuantity
        ? inventory1.filter((item) => item.quantity > 0)
        : inventory1;
    const filteredInventory2 = hideZeroQuantity
        ? inventory2.filter((item) => item.quantity > 0)
        : inventory2;

    return (
        
            <div className="container mx-auto p-4 pt-24">
                <h1 className="text-2xl font-bold mb-4">CSV Inventory Comparison</h1>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <h2 className="text-lg font-semibold mb-2">CSV 1</h2>
                        <textarea
                            className="w-full h-64 p-2 border rounded"
                            placeholder="Paste CSV 1 content here"
                            value={csv1}
                            onChange={handleCsv1Change}
                        />
                        <h3 className="text-md font-semibold mt-2">Inventory 1</h3>
                        <ul>
                            {filteredInventory1.map((item) => (
                                <li key={item.id}>
                                    {item.id}: {item.quantity}
                                </li>
                            ))}
                        </ul>
                        <button
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded mt-2"
                            onClick={() => {
                                const csv = inventoryToCsv(inventory1);
                                const blob = new Blob([csv], { type: "text/csv" });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "inventory1.csv";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                            }}
                        >
                            List to CSV 1
                        </button>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold mb-2">CSV 2</h2>
                        <textarea
                            className="w-full h-64 p-2 border rounded"
                            placeholder="Paste CSV 2 content here"
                            value={csv2}
                            onChange={handleCsv2Change}
                        />
                        <h3 className="text-md font-semibold mt-2">Inventory 2</h3>
                        <ul>
                            {filteredInventory2.map((item) => (
                                <li key={item.id}>
                                    {item.id}: {item.quantity}
                                </li>
                            ))}
                        </ul>
                        <button
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded mt-2"
                            onClick={() => {
                                const csv = inventoryToCsv(inventory2);
                                const blob = new Blob([csv], { type: "text/csv" });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "inventory2.csv";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                window.URL.revokeObjectURL(url);
                            }}
                        >
                            List to CSV 2
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="inline-flex items-center">
                        <input
                            type="checkbox"
                            className="mr-2"
                            checked={hideZeroQuantity}
                            onChange={(e) => setHideZeroQuantity(e.target.checked)}
                        />
                        <span className="text-gray-700">Hide 0 Quantity Items</span>
                    </label>
                </div>

                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={compareInventories}
                >
                    Compare Inventories
                </button>

                {differences.length > 0 && (
                    <div className="mt-4">
                        <h2 className="text-xl font-semibold">Differences</h2>
                        <ul>
                            {differences.map((diff, index) => (
                                <li key={index}>{diff}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {popularItems.length > 0 && (
                    <div className="mt-4">
                        <h2 className="text-xl font-semibold">Most Popular Items (Top 13)</h2>
                        <ul>
                            {popularItems.map((item, index) => (
                                <li key={index}>
                                    {item.id}: {item.count}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {Object.keys(diffCounts).length > 0 && (
                    <div className="mt-4">
                        <h2 className="text-xl font-semibold">Quantity Differences</h2>
                        <ul>
                            {Object.entries(diffCounts).map(([id, diff], index) => (
                                <li key={index}>
                                    {id}: {diff}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-4">
                    <h2 className="text-xl font-semibold">Wildberries and Ozon Tools</h2>
                    <p>
                        These tools would integrate with Wildberries and Ozon APIs to
                        facilitate inventory management and product updates.
                    </p>

                    <button
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
                        onClick={handleUploadToSupabase}
                        disabled={uploading}
                    >
                        {uploading ? "Uploading..." : "Upload to Supabase"}
                    </button>
                </div>
            </div>
        
    );
};

export default CSVCompare;