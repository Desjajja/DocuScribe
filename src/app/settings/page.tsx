'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const PROVIDER_KEY = 'docuscribe:provider';

export default function SettingsPage() {
  const [provider, setProvider] = useState('gemini');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROVIDER_KEY);
      if (saved) setProvider(saved);
    } catch {}
  }, []);

  const handleChange = (val: string) => {
    setProvider(val);
    try { localStorage.setItem(PROVIDER_KEY, val); } catch {}
  };

  return (
    <div className="max-w-xl mx-auto w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>Select the default AI provider for hashtag generation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={handleChange}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            This selection applies to all future scraping tasks. If the provider fails, hashtags will be left empty.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
