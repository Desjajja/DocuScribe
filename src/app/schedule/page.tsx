'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from '@/components/ui/label';
import { MoreHorizontal, CalendarClock, Ban } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { getDocuments, updateDocumentSchedule } from '@/app/actions';

type Schedule = 'none' | 'daily' | 'weekly' | 'monthly';

type Document = {
  id: number;
  title: string;
  url: string;
  schedule: Schedule;
  maxPages: number;
};

export default function SchedulePage() {
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editSchedule, setEditSchedule] = useState<Schedule>('none');
  const [isLoading, setIsLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await getDocuments();
      setAllDocuments(docs.map(({id, title, url, schedule, maxPages}) => ({id, title, url, schedule, maxPages})));
    } catch (error) {
      console.error("Failed to load documents from DB", error);
      toast({
        title: "Error",
        description: "Could not load documents from the database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const scheduledDocuments = useMemo(() => {
    return allDocuments.filter(doc => doc.schedule && doc.schedule !== 'none');
  }, [allDocuments]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocs(new Set(scheduledDocuments.map(doc => doc.id)));
    } else {
      setSelectedDocs(new Set());
    }
  };

  const handleSelectDoc = (docId: number, checked: boolean) => {
    const newSelection = new Set(selectedDocs);
    if (checked) {
      newSelection.add(docId);
    } else {
      newSelection.delete(docId);
    }
    setSelectedDocs(newSelection);
  };
  
  const handleCancelSelected = async () => {
    if (selectedDocs.size === 0) return;
    const updates = Array.from(selectedDocs).map(id => updateDocumentSchedule(id, 'none'));
    await Promise.all(updates);
    await loadDocuments();
    toast({ title: "Schedules Canceled", description: `Canceled ${selectedDocs.size} scheduled update(s).` });
    setSelectedDocs(new Set());
  };

  const handleApplyEdit = async () => {
    if (selectedDocs.size === 0) return;
    const updates = Array.from(selectedDocs).map(id => updateDocumentSchedule(id, editSchedule));
    await Promise.all(updates);
    await loadDocuments();
    toast({ title: "Schedules Updated", description: `Updated ${selectedDocs.size} schedule(s) to ${editSchedule}.` });
    setSelectedDocs(new Set());
    setIsEditing(false);
  }

  const getNextUpdate = (schedule: Schedule): string => {
      // Placeholder logic
      switch(schedule) {
          case 'daily': return 'In < 24 hours';
          case 'weekly': return 'In < 7 days';
          case 'monthly': return 'In < 30 days';
          default: return 'N/A';
      }
  }

  const handleCancelSingle = async (docId: number) => {
      await updateDocumentSchedule(docId, 'none');
      await loadDocuments();
      toast({ title: "Schedule Canceled", description: `The scheduled update has been canceled.` });
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Scheduled Tasks</h1>
        <p className="text-muted-foreground">Manage and monitor your automated documentation updates.</p>
      </header>
      
      {isLoading ? (
        <p>Loading scheduled tasks...</p>
      ) : scheduledDocuments.length > 0 ? (
        <div className="border rounded-lg">
            <div className="p-4 flex items-center gap-4">
                <Button onClick={() => setIsEditing(true)} disabled={selectedDocs.size === 0}>Edit Selected</Button>
                <Button onClick={handleCancelSelected} variant="destructive" disabled={selectedDocs.size === 0}>Cancel Selected</Button>
            </div>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedDocs.size > 0 && selectedDocs.size === scheduledDocuments.length}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead>Documentation</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Max Pages</TableHead>
                <TableHead>Next Update (Est.)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledDocuments.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedDocs.has(doc.id)}
                      onCheckedChange={(checked) => handleSelectDoc(doc.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link href="/library" className="font-medium text-primary hover:underline">{doc.title}</Link>
                    <div className="text-xs text-muted-foreground truncate">{doc.url}</div>
                  </TableCell>
                  <TableCell>
                      <Badge variant="secondary" className="capitalize">{doc.schedule}</Badge>
                  </TableCell>
                   <TableCell>{doc.maxPages}</TableCell>
                  <TableCell>{getNextUpdate(doc.schedule)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCancelSingle(doc.id)}>
                                <Ban className="mr-2 h-4 w-4" />
                                <span>Cancel Schedule</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg p-12 min-h-[400px]">
            <CalendarClock className="w-16 h-16 text-muted-foreground" />
            <h2 className="mt-6 text-xl font-semibold">No Scheduled Tasks</h2>
            <p className="mt-2 text-sm text-muted-foreground">
                You haven't scheduled any documentation to be updated automatically.
            </p>
            <Button asChild className="mt-6">
                <Link href="/library">Go to Library to Add Schedules</Link>
            </Button>
        </div>
      )}

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Schedules</DialogTitle>
                <DialogDescription>
                    Apply a new update schedule to the {selectedDocs.size} selected document(s).
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="edit-schedule">New Schedule</Label>
                <Select value={editSchedule} onValueChange={(value: Schedule) => setEditSchedule(value)}>
                    <SelectTrigger id="edit-schedule">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None (Cancel)</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={handleApplyEdit}>Apply to All</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
