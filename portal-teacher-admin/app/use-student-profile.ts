"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StudentProfile } from "./student-profile";

export type StudentProfileLoadState = "idle" | "loading" | "ready" | "error";

type StudentProfileLoadSnapshot = {
  key: string;
  details: Partial<StudentProfile>;
  status: StudentProfileLoadState;
  error: string;
};

const profileCache = new Map<string, Partial<StudentProfile>>();
const pendingProfileLoads = new Map<string, Promise<Partial<StudentProfile>>>();

function cacheKey(profile: StudentProfile) {
  return String(profile.id);
}

function initialLoadSnapshot(key: string, hasLoader: boolean): StudentProfileLoadSnapshot {
  const cached = profileCache.get(key);
  return {
    key,
    details: cached ?? {},
    status: hasLoader && !cached ? "idle" : "ready",
    error: "",
  };
}

export function useStudentProfile({
  student,
  loadProfile,
}: {
  student: StudentProfile;
  loadProfile?: (student: StudentProfile) => Promise<Partial<StudentProfile>>;
}) {
  const key = cacheKey(student);
  const [loadSnapshot, setLoadSnapshot] = useState<StudentProfileLoadSnapshot>(
    () => initialLoadSnapshot(key, Boolean(loadProfile)),
  );
  const activeKey = useRef(key);
  useEffect(() => {
    activeKey.current = key;
  }, [key]);
  const snapshot = loadSnapshot.key === key
    ? loadSnapshot
    : initialLoadSnapshot(key, Boolean(loadProfile));

  const load = useCallback(async (force = false) => {
    if (!loadProfile) return student;

    if (!force) {
      const cached = profileCache.get(key);
      if (cached) {
        setLoadSnapshot({ key, details: cached, status: "ready", error: "" });
        return { ...student, ...cached };
      }
    } else {
      profileCache.delete(key);
      pendingProfileLoads.delete(key);
    }

    setLoadSnapshot({ key, details: snapshot.details, status: "loading", error: "" });

    try {
      let request = pendingProfileLoads.get(key);
      if (!request) {
        request = loadProfile(student);
        pendingProfileLoads.set(key, request);
      }
      const loaded = await request;
      profileCache.set(key, loaded);
      pendingProfileLoads.delete(key);
      if (activeKey.current === key) {
        setLoadSnapshot({ key, details: loaded, status: "ready", error: "" });
      }
      return { ...student, ...loaded };
    } catch (reason) {
      pendingProfileLoads.delete(key);
      if (activeKey.current === key) {
        setLoadSnapshot({
          key,
          details: snapshot.details,
          status: "error",
          error: reason instanceof Error ? reason.message : "学生详情暂时无法加载。",
        });
      }
      return student;
    }
  }, [key, loadProfile, snapshot.details, student]);

  const profile = useMemo(() => ({ ...student, ...snapshot.details }), [snapshot.details, student]);

  return { profile, status: snapshot.status, error: snapshot.error, load };
}
