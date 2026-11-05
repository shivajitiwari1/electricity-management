"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Trash2, Check, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type DocumentCategory = "ID_PROOF" | "ADDRESS_PROOF" | "RENT_AGREEMENT" | "NOC" | "PHOTO" | "VEHICLE_RC" | "OTHER" | "POLICE_PROOF";

type DocumentItem = {
  id: string;
  documentType: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  verified: boolean;
  createdAt: Date;
};

type Props = {
  applicationId: string;
  existingDocuments: DocumentItem[];
  onDocumentsChange?: (docs: DocumentItem[]) => void;
  phone?: string;
};

const REQUIRED_DOCUMENTS: Array<{ id: DocumentCategory; label: string; required: boolean }> = [
  { id: "ID_PROOF", label: "ID Proof", required: true },
  { id: "PHOTO", label: "Passport-size Photograph", required: true },
  { id: "RENT_AGREEMENT", label: "Rent Agreement / Lease Deed", required: true },
  { id: "POLICE_PROOF", label: "Police Verification Proof", required: false },
  { id: "VEHICLE_RC", label: "Vehicle RC (if applicable)", required: false },
];

export default function DocumentUpload({
  applicationId,
  existingDocuments,
  onDocumentsChange,
  phone,
}: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>(existingDocuments);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: DocumentCategory) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(`File type ${file.type} not allowed.`);
      return;
    }

    if (file.size > MAX_SIZE) {
      toast.error("File too large. Max 5 MB.");
      return;
    }

    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);

      const url = new URL(`/api/tenant-verification/applications/${applicationId}/documents`, window.location.origin);
      if (phone) url.searchParams.set("phone", phone);

      const res = await fetch(url.toString(), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Upload failed");
      }

      const json = await res.json();
      const newDoc: DocumentItem = {
        id: json.document.id,
        documentType: json.document.documentType as DocumentCategory,
        fileName: json.document.fileName,
        mimeType: json.document.mimeType,
        sizeBytes: json.document.sizeBytes,
        verified: json.document.verified,
        createdAt: new Date(json.document.createdAt),
      };

      setDocuments([...documents, newDoc]);
      onDocumentsChange?.([...documents, newDoc]);
      toast.success(`Uploaded ${file.name}`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(null);
    }
    e.target.value = "";
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`/api/tenant-verification/applications/${applicationId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setDocuments(documents.filter((d) => d.id !== docId));
      onDocumentsChange?.(documents.filter((d) => d.id !== docId));
      toast.success("Document removed");
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getDocByType = (type: DocumentCategory) => documents.find((d) => d.documentType === type);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Upload the following documents. All files are stored privately and accessible only to
          you, the flat owner, and management staff.
        </p>
        <p className="text-xs text-muted-foreground">
          Max file size: 5 MB. Allowed formats: JPG, PNG, WEBP, PDF.
        </p>
      </div>

      <div className="space-y-3">
        {REQUIRED_DOCUMENTS.map((doc) => {
          const existing = getDocByType(doc.id);
          return (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-white"
            >
              <div className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.required ? "Required" : "Optional"}
                  </p>
                </div>
                <Badge
                  variant={existing ? "secondary" : "outline"}
                  className={existing ? "text-emerald-600" : ""}
                >
                  {existing ? "Uploaded" : "Pending"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {existing ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(
                          `/api/tenant-verification/applications/${applicationId}/documents/${existing.id}`,
                          "_blank"
                        );
                      }}
                    >
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(existing.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Upload className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => handleUpload(e, doc.id)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            All Documents ({documents.length})
          </p>
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{doc.documentType}</span>
                  <span className="text-xs">{formatSize(doc.sizeBytes)}</span>
                  {doc.verified && <Check className="h-3 w-3 text-emerald-600" />}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(
                        `/api/tenant-verification/applications/${applicationId}/documents/${doc.id}`,
                        "_blank"
                      );
                    }}
                  >
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-2 w-2" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-4 border-t">
        <AlertTriangle className="h-4 w-4 text-amber-500 mr-2" />
        <span className="text-xs text-amber-600">
          Documents will be reviewed by management. You can replace any document before
          submission. Once submitted, documents cannot be replaced without a correction request.
        </span>
      </div>
    </div>
  );
}
