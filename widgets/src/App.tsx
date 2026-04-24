import {
  useApp,
  useDocumentTheme,
  useHostStyles,
} from "@modelcontextprotocol/ext-apps/react";
import { LoadingIndicator } from "@openai/apps-sdk-ui/components/Indicator";
import { useState } from "react";
import type { MovieDetail, MoviesResponse } from "./types";
import { MoviesList } from "./movie-list";
import { MovieDetails } from "./movie-details";

interface ToolOutput {
  movies?: MoviesResponse;
  movie?: MovieDetail;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function App() {
  const [toolOutput, setToolOutput] = useState<ToolOutput | undefined>(
    undefined,
  );
  const { app, isConnected, error } = useApp({
    appInfo: { name: "Movies Client", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result) => {
        if (isRecord(result.structuredContent)) {
          setToolOutput(result.structuredContent);
        }
      };
    },
  });
  useHostStyles(app, app?.getHostContext());

  const theme = useDocumentTheme();

  const content = error ? (
    <div className="p-5 text-sm text-secondary">{error.message}</div>
  ) : toolOutput?.movies ? (
    <MoviesList movies={toolOutput.movies} />
  ) : toolOutput?.movie ? (
    <MovieDetails movie={toolOutput.movie} />
  ) : (
    <div className="flex min-h-20 items-center justify-center p-5">
      <LoadingIndicator size={32} />
    </div>
  );

  return (
    <div className="min-h-20 w-full bg-surface text-default">
      <div className="flex items-center justify-between border-b border-subtle px-5 py-3 text-xs text-secondary">
        <span>{isConnected ? "Connected" : "Connecting"}</span>
        <span className="capitalize">{theme}</span>
      </div>
      {content}
    </div>
  );
}

export default App;
