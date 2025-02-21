// app/invoices/page.tsx
"use client"
import { useEffect, useState } from "react"
import { useAppContext } from "@/contexts/AppContext" // Adjust path as needed
import { getUserInvoices } from "@/hooks/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

export default function Invoices() {
  const { dbUser } = useAppContext() // Assuming this provides user data and JWT
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!dbUser) return

      const { data, error } = await getUserInvoices(dbUser.user_id)
      if (error) {
        console.error("Error fetching invoices:", error)
      } else {
        setInvoices(data || [])
      }
      setLoading(false)
    }

    fetchInvoices()
  }, [dbUser])

  if (loading) return <div className="pt-20 text-center">Loading...</div>
  if (!invoices.length) return <div className="pt-20 text-center">No invoices yet.</div>

  const unpaidInvoices = invoices.filter((inv) => inv.status === "pending")
  const paidInvoices = invoices.filter((inv) => inv.status === "paid")

  return (
    <div className="container mx-auto px-4 py-8 pt-20"> {/* Padding for header */}
      <h1 className="text-3xl font-bold mb-6">Your Invoices</h1>

      {/* Unpaid Invoices (Cart Style) */}
      {unpaidInvoices.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-red-600 mb-4">Unpaid Invoices</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount (XTR)</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unpaidInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="bg-red-50 hover:bg-red-100">
                  <TableCell>{invoice.type === "subscription" ? "Subscription" : "Car Rental"}</TableCell>
                  <TableCell>{invoice.amount}</TableCell>
                  <TableCell>
                    {invoice.type === "car_rental" ? (
                      `${invoice.metadata.car_make} ${invoice.metadata.car_model} for ${invoice.metadata.days} days`
                    ) : (
                      `Subscription ${invoice.metadata.subscription_id}`
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="destructive" onClick={() => {/* Add payment logic */}}>
                      Pay Now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paid Invoices (Glory Corner) */}
      {paidInvoices.length > 0 && (
        <div className="bg-green-100 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-green-700 mb-4">Paid Invoices 🎉</h2>
          <Table>
            <TableBody>
              {paidInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="bg-green-50">
                  <TableCell>{invoice.type === "subscription" ? "Subscription" : "Car Rental"}</TableCell>
                  <TableCell>{invoice.amount} XTR</TableCell>
                  <TableCell>
                    {invoice.type === "car_rental" ? (
                      `${invoice.metadata.car_make} ${invoice.metadata.car_model} for ${invoice.metadata.days} days`
                    ) : (
                      `Subscription ${invoice.metadata.subscription_id}`
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

