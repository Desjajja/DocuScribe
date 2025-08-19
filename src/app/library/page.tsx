'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import Image from 'next/image';

const mockDocuments = [
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
  {
    id: 4,
    title: 'ShadCN UI Components',
    url: 'https://ui.shadcn.com/docs',
    snippet: 'Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'ui components'
  },
    {
    id: 5,
    title: 'Introduction to TypeScript',
    url: 'https://www.typescriptlang.org/docs/handbook/intro.html',
    snippet: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'typescript code'
  },
  {
    id: 6,
    title: 'Firebase Documentation',
    url: 'https://firebase.google.com/docs',
    snippet: 'Firebase helps you build and run successful apps. Backed by Google and loved by app development teams - from startups to global enterprises.',
    image: 'https://placehold.co/600x400.png',
    aiHint: 'database hosting'
  },
];

export default function LibraryPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocuments = useMemo(() => {
    if (!searchTerm) return mockDocuments;
    return mockDocuments.filter(doc =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.snippet.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

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
