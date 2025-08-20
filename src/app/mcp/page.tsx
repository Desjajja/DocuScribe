'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ClipboardCopy, Server } from "lucide-react";

export default function McpServerPage() {
  const [hasCopied, setHasCopied] = useState(false);

  const vscodeSettings = {
    "mcp": {
      "servers": {
        "context7": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@upstash/context7-mcp"]
        }
      }
    }
  };

  const settingsString = JSON.stringify(vscodeSettings, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(settingsString).then(() => {
      setHasCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "The VS Code settings have been copied.",
      });
      setTimeout(() => setHasCopied(false), 2000); // Reset icon after 2 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Copy Failed",
        description: "Could not copy settings to clipboard.",
        variant: "destructive",
      });
    });
  };

  return (
    <div className="flex flex-col gap-4">
       <header>
        <h1 className="text-3xl font-bold tracking-tight">MCP Server Configuration</h1>
        <p className="text-muted-foreground">Connect your editor to the DocuScribe knowledge base.</p>
      </header>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-6 h-6" />
            VS Code Integration
          </CardTitle>
          <CardDescription>
            To connect your VS Code editor to the DocuScribe MCP server, add the following configuration to your global <code>settings.json</code> file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={handleCopy}
            >
              <ClipboardCopy className={`h-4 w-4 transition-transform ${hasCopied ? 'scale-75' : 'scale-100'}`} />
              <span className="sr-only">Copy code</span>
            </Button>
            <pre className="bg-muted rounded-md p-4 text-sm overflow-x-auto">
              <code>
                {settingsString}
              </code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
