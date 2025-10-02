"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import type { WarehouseItem } from "@/app/wb/common";

interface AlarmDashboardProps {
  alarms: WarehouseItem[];
}

export default function AlarmDashboard({ alarms }: AlarmDashboardProps) {
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Alarm Dashboard - Low Stock Items</CardTitle>
      </CardHeader>
      <CardContent>
        {alarms.length === 0 ? (
          <p>No alarms currently.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Current Qty</TableHead>
                <TableHead>Min Qty</TableHead>
                <TableHead>Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alarms.map((item) => {
                const currentQty = item.total_quantity;
                const minQty = item.specs?.min_quantity || 0;
                const diff = currentQty - minQty;
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.make} {item.model}</TableCell>
                    <TableCell>{currentQty}</TableCell>
                    <TableCell>{minQty}</TableCell>
                    <TableCell>{diff}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Item Details: {selectedItem?.id}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-2">
              <img src={selectedItem.image_url} alt={selectedItem.id} className="w-full h-48 object-cover" />
              <p><strong>Name:</strong> {selectedItem.make} {selectedItem.model}</p>
              <p><strong>Description:</strong> {selectedItem.description}</p>
              <p><strong>Total Quantity:</strong> {selectedItem.total_quantity}</p>
              <p><strong>Min Quantity:</strong> {selectedItem.specs?.min_quantity || 0}</p>
              <p><strong>Season:</strong> {selectedItem.specs?.season || "N/A"}</p>
              <p><strong>Pattern:</strong> {selectedItem.specs?.pattern || "N/A"}</p>
              <p><strong>Color:</strong> {selectedItem.specs?.color || "N/A"}</p>
              <p><strong>Size:</strong> {selectedItem.specs?.size || "N/A"}</p>
              <p><strong>Locations:</strong></p>
              <ul>
                {selectedItem.specs?.warehouse_locations?.map((loc: any, idx: number) => (
                  <li key={idx}>{loc.voxel_id}: {loc.quantity}</li>
                )) || <li>No locations</li>}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}