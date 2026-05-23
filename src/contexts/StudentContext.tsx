import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface StudentContextType {
  /** Display name of the selected pupil (shown in chip, sent to edge functions). */
  currentStudent: string;
  /** UUID of the selected pupil row (null if using legacy localStorage flow). */
  currentPupilId: string | null;
  setCurrentStudent: (name: string, pupilId?: string | null) => void;
  isProfileSet: boolean;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const [currentStudent, setCurrentStudentRaw] = useState(() => {
    try { return localStorage.getItem("currentStudent") ?? ""; } catch { return ""; }
  });
  const [currentPupilId, setCurrentPupilId] = useState<string | null>(() => {
    try { return localStorage.getItem("currentPupilId"); } catch { return null; }
  });

  const setCurrentStudent = useCallback((name: string, pupilId: string | null = null) => {
    const trimmed = name.trim();
    setCurrentStudentRaw(trimmed);
    setCurrentPupilId(pupilId);
    try {
      localStorage.setItem("currentStudent", trimmed);
      if (pupilId) localStorage.setItem("currentPupilId", pupilId);
      else localStorage.removeItem("currentPupilId");
    } catch { /* noop */ }
  }, []);

  return (
    <StudentContext.Provider
      value={{
        currentStudent,
        currentPupilId,
        setCurrentStudent,
        isProfileSet: currentStudent.length > 0,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudent must be used within StudentProvider");
  return ctx;
};
