'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import Image from 'next/image';

type Document = {
  id: number;
  title: string;
  url: string;
  snippet: string;
  image: string;
  aiHint: string;
};

const initialDocuments: Document[] = [
  {
    id: 1,
    title: 'Getting Started with React',
    url: 'https://react.dev/learn',
    snippet: 'Learn how to build user interfaces with React, the popular JavaScript library for building component-based UIs.',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'code react'
  },
  {
    id: 2,
    title: 'Next.js Documentation',
    url: 'https://nextjs.org/docs',
    snippet: 'The React Framework for Production. Next.js gives you the best developer experience with all the features you need for production.',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'framework code'
  },
  {
    id: 3,
    title: 'Tailwind CSS Docs',
    url: 'https://tailwindcss.com/docs',
    snippet: 'A utility-first CSS framework packed with classes that can be composed to build any design, directly in your markup.',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'design css'
  },
];

export default function LibraryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    try {
      const storedDocsString = localStorage.getItem('scrapedDocuments');
      if (storedDocsString) {
        const storedDocs = JSON.parse(storedDocsString);
        setDocuments(storedDocs);
      } else {
        // If no docs are in storage, use the initial set and store them.
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
      doc.snippet.toLowerCase().includes(searchTerm.toLowerCase())
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
            <Card key={doc.id} className="overflow-hidden hover:shadow-lg transition-shadow">
               <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block">
                <div className="relative h-40 w-full">
                    <Image src={doc.image} alt={doc.title} fill objectFit="cover" data-ai-hint={doc.aiHint} />
                </div>
                <CardHeader>
                  <CardTitle>{doc.title}</CardTitle>
                  <CardDescription className="text-xs">{doc.url}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{doc.snippet}</p>
                </CardContent>
               </a>
            </Card>
          ))
        ) : (
          <p className="col-span-full text-center text-muted-foreground">No documents found.</p>
        )}
      </div>
    </div>
  );
}
