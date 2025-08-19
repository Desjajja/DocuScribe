'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Download, Sparkles } from "lucide-react";
import { summarizeMcpData } from '@/ai/flows/summarize-mcp-data';

export default function McpDataPage() {
  const [mcpData, setMcpData] = useState('');
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSummarize = async () => {
    if (!mcpData.trim()) {
      toast({
        title: "Error",
        description: "Please enter MCP subscription data to summarize.",
        variant: "destructive",
      });
      return;
    }
    setIsSummarizing(true);
    setSummary('');
    try {
      const result = await summarizeMcpData({ mcpData });
      setSummary(result.summary);
      toast({
        title: "Summary Generated",
        description: "The AI-powered summary is ready.",
      });
    } catch (error) {
      console.error("Error summarizing data:", error);
      toast({
        title: "Summarization Failed",
        description: "An error occurred while generating the summary.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  };
  
  const parsedData = mcpData.split('\n').filter(line => line.trim() !== '').map((line, index) => {
    const parts = line.split(':');
    return {
        key: parts[0] ? parts[0].trim() : `item_${index}`,
        value: parts[1] ? parts[1].trim() : line.trim(),
    }
  });

  const exportData = (format: 'json' | 'csv') => {
    setIsExporting(true);
    
    let dataStr: string;
    let mimeType: string;
    let fileExtension: string;

    if (format === 'json') {
        const jsonObject = parsedData.reduce((obj, item) => {
            obj[item.key] = item.value;
            return obj;
        }, {} as Record<string, string>);
        dataStr = JSON.stringify(jsonObject, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
    } else { // csv
        const headers = 'key,value';
        const rows = parsedData.map(item => `"${item.key.replace(/"/g, '""')}","${item.value.replace(/"/g, '""')}"`).join('\n');
        dataStr = `${headers}\n${rows}`;
        mimeType = 'text/csv';
        fileExtension = 'csv';
    }

    const blob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mcp_data.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
        title: "Export Successful",
        description: `MCP data has been exported as a ${format.toUpperCase()} file.`
    });
    setIsExporting(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>MCP Subscription Data</CardTitle>
            <CardDescription>
              Paste your MCP subscription data below to parse and summarize it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Example:&#10;Plan: Premium&#10;Users: 10&#10;Storage: 1TB"
              className="min-h-[300px] font-mono"
              value={mcpData}
              onChange={(e) => setMcpData(e.target.value)}
            />
          </CardContent>
        </Card>
         <div className="flex flex-wrap gap-2">
          <Button onClick={handleSummarize} disabled={isSummarizing || !mcpData.trim()} className="flex-grow">
              {isSummarizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                 <Sparkles className="mr-2 h-4 w-4" />
                 Generate AI Summary
                </>
              )}
            </Button>
            <Button onClick={() => exportData('json')} variant="outline" disabled={isExporting || !mcpData.trim()} className="flex-grow" >
                 <Download className="mr-2 h-4 w-4" />
                 Export as JSON
            </Button>
             <Button onClick={() => exportData('csv')} variant="outline" disabled={isExporting || !mcpData.trim()} className="flex-grow">
                 <Download className="mr-2 h-4 w-4" />
                 Export as CSV
            </Button>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI-Powered Summary
            </CardTitle>
            <CardDescription>
              A concise summary of your subscription's key features.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSummarizing && (
                <div className="space-y-3">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                    <div className="h-4 bg-muted rounded animate-pulse w-full"></div>
                    <div className="h-4 bg-muted rounded animate-pulse w-5/6"></div>
                </div>
            )}
            {summary && !isSummarizing && <p className="text-sm whitespace-pre-wrap">{summary}</p>}
            {!summary && !isSummarizing && (
              <p className="text-sm text-muted-foreground">
                Enter your MCP data and click 'Generate AI Summary' to see it here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
