import Header from "@/components/Header";
import ChoiceBoard from "@/components/ChoiceBoard";
import StudentSetupModal from "@/components/StudentSetupModal";
import StudentProfileChip from "@/components/StudentProfileChip";
import CoreStripBar from "@/components/board/CoreStripBar";
import { useStudent } from "@/contexts/StudentContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useHighContrast } from "@/hooks/useHighContrast";

const BoardWithCore = () => {
  const { currentStudent } = useStudent();
  const { highContrast } = useHighContrast();
  return (
    <>
      <main className="py-6 pb-28">
        <ChoiceBoard />
      </main>
      <CoreStripBar
        highContrast={highContrast}
        onSelect={(_key, label) => {
          // Core words always notify the TA, regardless of depth.
          supabase.functions
            .invoke("makaton-notifier", {
              body: { child_name: currentStudent, selection: label },
            })
            .catch(() => toast.error("Notification may not have sent"));
          toast.success(`"${label}" sent to TA`);
        }}
      />
    </>
  );
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header profileChip={<StudentProfileChip />} />
      <BoardWithCore />
      <StudentSetupModal />
    </div>
  );
};


export default Index;
