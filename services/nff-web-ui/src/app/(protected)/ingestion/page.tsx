"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square } from "lucide-react";
import { useState } from "react";
import { SidebarIngestion } from "./(components)/SidebarIngestion";

interface Service {
  id: string;
  primaryText: string;
  secondaryText: string;
  isRunning: boolean;
}

interface ServiceGroup {
  title: string;
  services: Service[];
}

export default function IngestionPage() {
  const [activeTab, setActiveTab] = useState<
    "configuration" | "query-events" | "catalyst-merge"
  >("configuration");
  const [services, setServices] = useState<ServiceGroup[]>([
    {
      title: "Twitter/X Ingestion via Lobstr API",
      services: [
        {
          id: "twitter-1",
          primaryText: "Service: 03:00 (Window time) IL",
          secondaryText: "Look back 4 hours",
          isRunning: false,
        },
        {
          id: "twitter-2",
          primaryText: "Service 2: Schedule at 11:00 IL",
          secondaryText: "Look back 8 hours",
          isRunning: false,
        },
        {
          id: "twitter-3",
          primaryText: "Service 3: Schedule at 14:00 IL",
          secondaryText: "Look back 3 hours",
          isRunning: false,
        },
        {
          id: "twitter-4",
          primaryText: "Service 4: Schedule at 15:33 IL",
          secondaryText: "Look back 1 hours 33 minutes",
          isRunning: false,
        },
      ],
    },
    {
      title: "Scrape Pre-Market/Movers from TradingView",
      services: [
        {
          id: "tradingview-1",
          primaryText: "Service: Pre Market Gainers",
          secondaryText: "TradingView scraper writes daily",
          isRunning: false,
        },
        {
          id: "tradingview-2",
          primaryText: "Service: Pre Market Losers",
          secondaryText: "TradingView scraper writes daily",
          isRunning: false,
        },
      ],
    },
  ]);

  const toggleService = (groupId: number, serviceId: string) => {
    setServices((prev) =>
      prev.map((group, gIdx) => {
        if (gIdx === groupId) {
          return {
            ...group,
            services: group.services.map((service) =>
              service.id === serviceId
                ? { ...service, isRunning: !service.isRunning }
                : service
            ),
          };
        }
        return group;
      })
    );
  };

  return (
    <div className="min-h-[calc(100vh-78px)] h-[calc(100vh-78px)] flex -mx-6 -mt-6 w-[calc(100%+3rem)]">
      {/* Left Sidebar Navigation */}
      <SidebarIngestion activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="p-8 space-y-6">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">
              Data Ingestion Service Console
            </h1>
          </div>

          {/* Service Panels */}
          {activeTab === "configuration" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {services.map((group, groupId) => (
                <Card key={group.title} className="border-border">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4">
                      {group.title}
                    </h2>
                    <div className="space-y-3">
                      {group.services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground mb-1">
                              {service.primaryText}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {service.secondaryText}
                            </p>
                          </div>
                          <Button
                            onClick={() => toggleService(groupId, service.id)}
                            variant={
                              service.isRunning ? "destructive" : "default"
                            }
                            size="sm"
                            className="ml-4"
                          >
                            {service.isRunning ? (
                              <>
                                <Square className="h-4 w-4 mr-1" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Run
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Placeholder for other tabs */}
          {activeTab !== "configuration" && (
            <Card className="border-border">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  {activeTab === "query-events" &&
                    "Query events functionality coming soon"}
                  {activeTab === "catalyst-merge" &&
                    "Catalyst merge functionality coming soon"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
