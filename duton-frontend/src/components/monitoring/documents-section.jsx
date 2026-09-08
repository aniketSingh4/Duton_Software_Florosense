"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ExternalLink, Trash2, Loader2, Upload } from "lucide-react"
import { uploadSensorDocument, getSensorDocuments, downloadSensorDocument, deleteSensorDocument, fetchUserSensors } from "@/utils/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function DocumentsSection({ sensorId }) {
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [documentType, setDocumentType] = useState("")
  const [userRole, setUserRole] = useState(null)
  const [currentUsername, setCurrentUsername] = useState(null)
  const fileInputRef = useRef(null)

  const documentTypes = [
    "Device Manual",
    "Technical Specs",
    "Warranty Details",
    "Certifications",
    "Service/Calibration report"
  ]

  // Check user role and username
  useEffect(() => {
    if (typeof window === "undefined") return
    
    const checkUserRole = async () => {
      let role = null
      let username = null
      
      const userType = window.localStorage.getItem("duton_user_type")
      username = window.localStorage.getItem("duton_username")
      
      try {
        const TICKET_API_BASE_URL = process.env.NEXT_PUBLIC_TICKET_API_URL || "http://localhost:8001/api"
        const token = window.localStorage.getItem("duton_access_token")
        
        if (token && TICKET_API_BASE_URL) {
          try {
            const response = await fetch(`${TICKET_API_BASE_URL}/auth/me`, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            })
            
            if (response.ok) {
              const data = await response.json()
              role = data?.role || data?.data?.role || null
              username = data?.username || data?.data?.username || username
            }
          } catch (e) {
            // Fall through to JWT decode
          }
        }
      } catch (error) {
      }
      
      if (!role) {
        try {
          const token = window.localStorage.getItem("duton_access_token")
          if (token) {
            const tokenParts = token.split('.')
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
              role = payload.role || null
              username = payload.username || username
            }
          }
        } catch (error) {
        }
      }
      
      if (!role && userType) {
        role = userType === "admin" ? "admin" : userType === "assignee" ? "assignee" : "user"
      }
      
      setUserRole(role)
      setCurrentUsername(username)
    }
    
    checkUserRole()
  }, [])

  // Load documents - All users (admin, assignee, technician, engineer, user, owner) can view documents
  // if they have access to the sensor (backend handles access control)
  useEffect(() => {
    if (!sensorId) return
    
    const loadDocuments = async () => {
      setIsLoading(true)
      try {
        const docs = await getSensorDocuments(sensorId)
        setDocuments(docs)
      } catch (error) {
        console.error("Failed to load documents:", error)
        // Don't show error toast on initial load
      } finally {
        setIsLoading(false)
      }
    }
    
    loadDocuments()
  }, [sensorId])

  const handleDocumentClick = async (doc) => {
    if (doc && doc.id) {
      // Document exists, download it
      try {
        await downloadSensorDocument(sensorId, doc.id, doc.filename)
        toast.success("Document downloaded")
      } catch (error) {
        console.error("Download error:", error)
        toast.error(error.message || "Failed to download document")
      }
    }
  }

  const handleEmptyClick = () => {
    // No documents, open upload popup
    setUploadDialogOpen(true)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB")
        e.target.value = null
        return
      }
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !sensorId) {
      toast.error("Please select a file")
      return
    }

    if (!documentType) {
      toast.error("Please select a document type")
      return
    }

    setIsUploading(true)
    try {
      await uploadSensorDocument(sensorId, selectedFile, documentType)
      toast.success("Document uploaded successfully")
      setUploadDialogOpen(false)
      setSelectedFile(null)
      setDocumentType("")
      
      // Reload documents
      const docs = await getSensorDocuments(sensorId)
      setDocuments(docs)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error.message || "Failed to upload document")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = null
      }
    }
  }

  const handleDelete = async (e, document) => {
    e.stopPropagation()
    
    if (!confirm(`Are you sure you want to delete "${document.filename}"?`)) {
      return
    }

    try {
      await deleteSensorDocument(sensorId, document.id)
      toast.success("Document deleted successfully")
      
      // Reload documents
      const docs = await getSensorDocuments(sensorId)
      setDocuments(docs)
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(error.message || "Failed to delete document")
    }
  }

  // Upload/Delete: Admin (all sensors), Assignee/Technician/Engineer (assigned sensors only)
  // Need to check if user has access to this sensor for assignee/technician/engineer
  const [hasSensorAccess, setHasSensorAccess] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  
  useEffect(() => {
    if (!sensorId || !userRole) {
      setIsCheckingAccess(false)
      return
    }
    
    const checkSensorAccess = async () => {
      setIsCheckingAccess(true)
      try {
        const userSensors = await fetchUserSensors()
        const hasAccess = userSensors.some(s => s.sensor_id === sensorId || s.identifier === sensorId)
        setHasSensorAccess(hasAccess)
      } catch (error) {
        setHasSensorAccess(false)
      } finally {
        setIsCheckingAccess(false)
      }
    }
    
    // Only check access for non-admin roles
    if (userRole !== "admin") {
      checkSensorAccess()
    } else {
      setHasSensorAccess(true) // Admin has access to all sensors
      setIsCheckingAccess(false)
    }
  }, [sensorId, userRole])
  
  const canUpload = userRole === "admin" || 
    (userRole === "assignee" && hasSensorAccess) ||
    (userRole === "technician" && hasSensorAccess) ||
    (userRole === "engineer" && hasSensorAccess)
    
  const canDelete = (document) => {
    return userRole === "admin" || 
      (userRole === "assignee" && hasSensorAccess) ||
      (userRole === "technician" && hasSensorAccess) ||
      (userRole === "engineer" && hasSensorAccess)
  }

  if (!sensorId) {
    return null
  }

  return (
    <>
      <Card className="shadow-sm border-border/50 py-4">
        <CardHeader className="pb-2 pt-0 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Documents</CardTitle>
            {canUpload && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={isUploading}
                type="button"
                onClick={() => setUploadDialogOpen(true)}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            // For assignee and engineer without sensor access, show plain "No document found" text
            // For others, also show plain "No document found" text
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>No document found</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-2 group"
                >
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      handleDocumentClick(doc)
                    }}
                    className="flex items-center gap-2 text-sm text-primary hover:underline flex-1"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="truncate">{doc.document_type || doc.filename}</span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  {canDelete(doc) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDelete(e, doc)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog 
        open={uploadDialogOpen} 
        onOpenChange={(open) => {
          setUploadDialogOpen(open)
          if (!open) {
            // Reset form when dialog closes
            setSelectedFile(null)
            setDocumentType("")
            if (fileInputRef.current) {
              fileInputRef.current.value = null
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document for this sensor. Maximum file size: 10MB
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Document Type</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                required
              >
                <option value="">Select document type</option>
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">File</label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png"
                disabled={isUploading}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadDialogOpen(false)
                }}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!selectedFile || !documentType || isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
