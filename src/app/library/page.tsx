'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MoreVertical, Edit, Trash2, Download } from 'lucide-react';
import Image from 'next/image';
import { toast } from '@/hooks/use-toast';

type Document = {
  id: number;
  title: string;
  url: string;
  image: string;
  aiHint: string;
  content: string;
  hashtags: string[];
};

type ParsedSection = {
  title: string;
  url: string;
  content: string;
};

const initialDocuments: Document[] = [
  {
    id: 1,
    title: 'Getting Started with React',
    url: 'https://react.dev/learn',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'code react',
    content: '## Getting Started\n\nURL: https://react.dev/learn\n\nThis is an example document. Scrape a website to add real content to your library.',
    hashtags: ['react', 'javascript', 'frontend']
  },
];

export default function LibraryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = () => {
    try {
      const storedDocsString = localStorage.getItem('scrapedDocuments');
      if (storedDocsString) {
        const storedDocs = JSON.parse(storedDocsString);
        setDocuments(storedDocs);
      } else {
        setDocuments(initialDocuments);
        localStorage.setItem('scrapedDocuments', JSON.stringify(initialDocuments));
      }
    } catch (error) {
      console.error("Failed to load documents from localStorage", error);
      setDocuments(initialDocuments);
    }
  };
  
  useEffect(() => {
    loadDocuments();

    const handleStorageChange = () => {
        loadDocuments();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return documents;
    return documents.filter(doc =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.hashtags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, documents]);

  const handleRename = (doc: Document) => {
    setEditingDoc(doc);
    setNewTitle(doc.title);
  };

  const handleSaveRename = () => {
    if (!editingDoc || !newTitle.trim()) return;
    const updatedDocs = documents.map(d =>
      d.id === editingDoc.id ? { ...d, title: newTitle.trim() } : d
    );
    setDocuments(updatedDocs);
    localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
    toast({ title: "Document Renamed", description: `"${editingDoc.title}" was renamed to "${newTitle.trim()}".` });
    setEditingDoc(null);
  };

  const handleDelete = (docId: number) => {
    const updatedDocs = documents.filter(d => d.id !== docId);
    setDocuments(updatedDocs);
    localStorage.setItem('scrapedDocuments', JSON.stringify(updatedDocs));
    toast({ title: "Document Deleted", description: "The document has been removed from your library." });
  };

  const handleExportMarkdown = (doc: Document) => {
    // Sanitize title for filename
    const filename = `${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Exported to Markdown", description: `Downloaded as ${filename}` });
  };

  const parseContentToSections = (content: string): ParsedSection[] => {
    const sections = content.split('\n\n---\n\n');
    return sections.map(sectionText => {
      const lines = sectionText.split('\n');
      const titleMatch = lines[0]?.match(/^## (.*)/);
      const title = titleMatch ? titleMatch[1] : 'Content';
      const urlMatch = lines[1]?.match(/^URL: (.*)/);
      const url = urlMatch ? urlMatch[1] : '';
      const sectionContent = lines.slice(3).join('\n');
      return { title, url, content: sectionContent };
    });
  };
  
  useEffect(() => {
    if (editingDoc) {
      setTimeout(() => renameInputRef.current?.focus(), 100);
    }
  }, [editingDoc]);
  
  const selectedDocSections = useMemo(() => {
    if (selectedDoc) {
      return parseContentToSections(selectedDoc.content);
    }
    return [];
  }, [selectedDoc]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Documentation Library</h1>
        <p className="text-muted-foreground">Browse, search, and manage your scraped documentation.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by title, content, or #hashtag..."
          className="w-full pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocuments.length > 0 ? (
          filteredDocuments.map(doc => (
            <Card 
              key={doc.id}
              className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col group"
            >
              <div className="relative">
                <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedDoc(null)}>
                  <DialogTrigger asChild>
                    <div className="relative h-40 w-full cursor-pointer" onClick={() => setSelectedDoc(doc)}>
                      <Image src={doc.image} alt={doc.title} fill style={{ objectFit: "cover" }} data-ai-hint={doc.aiHint} />
                    </div>
                  </DialogTrigger>
                  {selectedDoc && selectedDoc.id === doc.id && (
                    <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>{selectedDoc.title}</DialogTitle>
                        <DialogDescription>
                          <a href={selectedDoc.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {selectedDoc.url}
                          </a>
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="flex-grow pr-6 -mr-6">
                        <Accordion type="single" collapsible className="w-full" defaultValue="item-0">
                          {selectedDocSections.map((section, index) => (
                             <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger><b>{section.title}</b></AccordionTrigger>
                                <AccordionContent>
                                    <p className="text-sm whitespace-pre-wrap">{section.content}</p>
                                </AccordionContent>
                             </AccordionItem>
                          ))}
                        </Accordion>
                      </ScrollArea>
                    </DialogContent>
                  )}
                </Dialog>
                <div className="absolute top-2 right-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-8 w-8 bg-black/50 hover:bg-black/75 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExportMarkdown(doc)}>
                                <Download className="mr-2 h-4 w-4" />
                                <span>Export as Markdown</span>
                            </DropdownMenuItem>
                             <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleRename(doc)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Rename</span>
                            </DropdownMenuItem>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the document titled "{doc.title}".
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(doc.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </div>
              <CardHeader className="flex-grow pb-2">
                <CardTitle className="line-clamp-2">{doc.title}</CardTitle>
                <CardDescription className="text-xs truncate pt-1">{doc.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">{doc.content}</p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 pt-2">
                  {doc.hashtags?.map(tag => (
                      <Badge key={tag} variant="secondary" className="font-normal">#{tag}</Badge>
                  ))}
              </CardFooter>
            </Card>
          ))
        ) : (
          <p className="col-span-full text-center text-muted-foreground">No documents found. Try scraping a website!</p>
        )}
      </div>

      <Dialog open={!!editingDoc} onOpenChange={(isOpen) => !isOpen && setEditingDoc(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rename Document</DialogTitle>
                <DialogDescription>Enter a new title for the document.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Input
                  ref={renameInputRef}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                  className="col-span-3"
                />
            </div>
            <DialogClose asChild>
                <Button onClick={handleSaveRename}>Save changes</Button>
            </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    