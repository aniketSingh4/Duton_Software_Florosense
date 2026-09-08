"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getAllSites, createSite, updateSite, deleteSite, fetchUserSensors } from "@/utils/api"

export function SiteManagement() {
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [allSensors, setAllSensors] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const searchTimeoutRef = useRef(null)
  const [formData, setFormData] = useState({
    site_name: "",
    site_address: "",
    client_name: "",
    location: { lat: "", lng: "" },
  })

  useEffect(() => {
    loadSites()
  }, [])

  const loadSites = async () => {
    setIsLoading(true)
    try {
      const data = await getAllSites()
      setSites(data || [])
      fetchUserSensors()
        .then((sensorsData) => {
          setAllSensors(sensorsData || [])
        })
        .catch(() => {
          setAllSensors([])
        })
    } catch (error) {
      toast.error(error.message || "Failed to load sites")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (site = null) => {
    if (site) {
      setEditingSite(site)
      setFormData({
        site_name: site.site_name || "",
        site_address: site.site_address || "",
        client_name: site.client_name || "",
        location: site.location || { lat: "", lng: "" },
      })
    } else {
      setEditingSite(null)
      setFormData({
        site_name: "",
        site_address: "",
        client_name: "",
        location: { lat: "", lng: "" },
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSite(null)
    setFormData({
      site_name: "",
      site_address: "",
      client_name: "",
      location: { lat: "", lng: "" },
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.site_name) {
      toast.error("Site name is required")
      return
    }

    try {
      const sitePayload = {
        site_name: formData.site_name,
        site_address: formData.site_address,
        client_name: formData.client_name,
        location: formData.location.lat && formData.location.lng
          ? { lat: parseFloat(formData.location.lat), lng: parseFloat(formData.location.lng) }
          : {},
      }

      if (editingSite) {
        await updateSite(editingSite.site_id || editingSite.site_name, sitePayload)
        toast.success("Site updated successfully")
      } else {
        await createSite(sitePayload)
        toast.success("Site created successfully")
      }
      handleCloseDialog()
      loadSites()
    } catch (error) {
      toast.error(error.message || "Failed to save site")
    }
  }

  const handleDelete = async () => {
    if (!editingSite) return

    try {
      await deleteSite(editingSite.site_id)
      toast.success("Site deleted successfully")
      setDeleteDialogOpen(false)
      setEditingSite(null)
      loadSites()
    } catch (error) {
      toast.error(error.message || "Failed to delete site")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Site Management</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Site
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search by site name or sensor ID..."
          value={searchInput}
          onChange={(e) => {
            const val = e.target.value
            setSearchInput(val)
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
            searchTimeoutRef.current = setTimeout(() => setSearchQuery(val), 400)
          }}
          className="max-w-sm"
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : sites.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No sites found. Create your first site to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center pl-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites
                .filter((site) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  if (site.site_name && site.site_name.toLowerCase().includes(query)) return true;
                  
                  const siteSensors = allSensors.filter(s => 
                    s.site_name === site.site_name || s.site_id === site.site_id
                  );
                  
                  return siteSensors.some(s => 
                    (s.sensor_id && s.sensor_id.toLowerCase().includes(query)) ||
                    (s.device_id && s.device_id.toLowerCase().includes(query))
                  );
                })
                .map((site) => (
                <TableRow key={site.site_id || site.site_name}>
                  <TableCell className="font-medium">{site.site_name}</TableCell>
                  <TableCell>{site.site_address || "-"}</TableCell>
                  <TableCell>{site.client_name || "-"}</TableCell>
                  <TableCell>
                    {site.location?.lat && site.location?.lng
                      ? `${site.location.lat}, ${site.location.lng}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center pl-4">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(site)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSite(site)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit Site" : "Create Site"}</DialogTitle>
            <DialogDescription>
              {editingSite
                ? "Update site information below."
                : "Fill in the details to create a new site."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="site_name">Site Name *</Label>
                <Input
                  id="site_name"
                  value={formData.site_name}
                  onChange={(e) =>
                    setFormData({ ...formData, site_name: e.target.value })
                  }
                  placeholder="Enter site name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_address">Site Address</Label>
                <Input
                  id="site_address"
                  value={formData.site_address}
                  onChange={(e) =>
                    setFormData({ ...formData, site_address: e.target.value })
                  }
                  placeholder="Enter site address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  placeholder="Enter client name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    value={formData.location.lat}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: { ...formData.location, lat: e.target.value },
                      })
                    }
                    placeholder="e.g., 28.6139"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    value={formData.location.lng}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: { ...formData.location, lng: e.target.value },
                      })
                    }
                    placeholder="e.g., 77.2090"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Site</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{editingSite?.site_name}"? This action cannot be undone.
              All site assignments will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setEditingSite(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

