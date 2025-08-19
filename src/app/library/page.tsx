'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import Image from 'next/image';

type Document = {
  id: number;
  title: string;
  url: string;
  image: string;
  aiHint: string;
  content: string;
};

const initialDocuments: Document[] = [
  {
    id: 1,
    title: 'Getting Started with React',
    url: 'https://react.dev/learn',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'code react',
    content: 'This is an example document. Scrape a website to add real content to your library.'
  },
];

export default function LibraryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  useEffect(() => {
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
  }, []);


  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return documents;
    return documents.filter(doc =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, documents]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Documentation Library</h1>
        <p className="text-muted-foreground">Browse and search your scraped documentation.</p>
      </header>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search documentation..."
          className="w-full pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocuments.length > 0 ? (
          filteredDocuments.map(doc => (
            <Dialog key={doc.id} onOpenChange={(isOpen) => !isOpen && setSelectedDoc(null)}>
              <DialogTrigger asChild>
                <Card 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer flex flex-col"
                  onClick={() => setSelectedDoc(doc)}
                >
                  <div className="relative h-40 w-full">
                      <Image src={doc.image} alt={doc.title} fill style={{objectFit:"cover"}} data-ai-hint={doc.aiHint} />
                  </div>
                  <CardHeader className="flex-grow">
                    <CardTitle className="line-clamp-2">{doc.title}</CardTitle>
                    <CardDescription className="text-xs truncate pt-1">{doc.url}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">{doc.content}</p>
                  </CardContent>
                </Card>
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
                     <p className="text-sm whitespace-pre-wrap">{selectedDoc.content}</p>
                  </ScrollArea>
                </DialogContent>
               )}
            </Dialog>
          ))
        ) : (
          <p className="col-span-full text-center text-muted-foreground">No documents found. Try scraping a website!</p>
        )}
      </div>
    </div>
  );
}
