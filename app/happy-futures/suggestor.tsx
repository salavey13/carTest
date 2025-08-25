"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import axios from "axios";

interface HappySuggestion {
  suggestion: string;
  reason: string;
}

export default function HappyFuturesSuggestor() {
  const [suggestions, setSuggestions] = useState<HappySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/happy-futures');
      if (response.data.success) {
        setSuggestions(response.data.suggestions);
        toast.success("Happy Futures suggestions loaded!");
      } else {
        setSuggestions([{ suggestion: 'buy tesla, swap rubles to XTR', reason: 'Default suggestion.' }]);
      }
    } catch (error) {
      toast.error("Error fetching suggestions.");
      logger.error(error);
      setSuggestions([{ suggestion: 'buy tesla, swap rubles to XTR', reason: 'Fallback in error.' }]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>DeepSearch Bot: Happy Futures Suggestions</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={fetchSuggestions} disabled={isLoading}>
          <VibeContentRenderer content="::FaRobot::" /> {isLoading ? 'Monitoring...' : 'Get Suggestions'}
        </Button>
        <ScrollArea className="h-48 mt-4">
          {suggestions.map((sug, i) => (
            <div key={i} className="mb-2 p-2 bg-muted rounded">
              <p className="font-bold">{sug.suggestion}</p>
              <p className="text-sm text-muted-foreground">{sug.reason}</p>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}