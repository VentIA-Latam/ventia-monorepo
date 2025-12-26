"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface RecentActivity {
  id: string;
  orderId: string;
  orderDbId: number;
  cliente: string;
  email: string;
  fecha: string;
  monto: string;
  estado: "Pagado" | "Pendiente" | "Rechazado";
  accion: "viewed" | "validated" | "created" | "updated";
  timestamp: number;
}

interface RecentActivityContextType {
  activities: RecentActivity[];
  addActivity: (activity: Omit<RecentActivity, "timestamp">) => void;
  clearActivities: () => void;
}

const RecentActivityContext = createContext<RecentActivityContextType | undefined>(undefined);

const STORAGE_KEY = "ventia_recent_activity";
const MAX_ACTIVITIES = 10;

export function RecentActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setActivities(parsed);
      } catch (e) {
        console.error("Error loading recent activity:", e);
      }
    }
  }, []);

  // Save to localStorage whenever activities change
  useEffect(() => {
    if (activities.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
    }
  }, [activities]);

  const addActivity = (activity: Omit<RecentActivity, "timestamp">) => {
    const newActivity: RecentActivity = {
      ...activity,
      timestamp: Date.now(),
    };

    setActivities((prev) => {
      // Remove duplicates (same orderId)
      const filtered = prev.filter((a) => a.orderDbId !== activity.orderDbId);
      // Add new activity at the beginning and limit to MAX_ACTIVITIES
      return [newActivity, ...filtered].slice(0, MAX_ACTIVITIES);
    });
  };

  const clearActivities = () => {
    setActivities([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <RecentActivityContext.Provider value={{ activities, addActivity, clearActivities }}>
      {children}
    </RecentActivityContext.Provider>
  );
}

export function useRecentActivity() {
  const context = useContext(RecentActivityContext);
  if (!context) {
    throw new Error("useRecentActivity must be used within RecentActivityProvider");
  }
  return context;
}
