import { Doc } from "../convex/_generated/dataModel";
    import ViolationReportForm from "./ViolationReportForm";
    import { useQuery } from "convex/react";
    import { api } from "../convex/_generated/api";
    import ViolationList from "./ViolationList";
    import { useState } from "react";
    import { Button } from "./components/ui/button";

    export default function GradeManagerDashboard({ profile }: { profile: Doc<"userProfiles"> }) {
        const [showViolations, setShowViolations] = useState(false);
        const violations = useQuery(
            api.violations.getViolationsForGradeManager,
            showViolations ? {} : "skip"
        );

        return (
            <div className="container mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                    <div className="lg:col-span-1">
                        <ViolationReportForm />
                    </div>
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xl font-semibold">Vi phạm trong Khối của bạn</h3>
                            <Button
                                onClick={() => setShowViolations(!showViolations)}
                                variant={showViolations ? "outline" : "default"}
                                className="text-sm"
                            >
                                {showViolations ? "Ẩn danh sách" : "Xem danh sách"}
                            </Button>
                        </div>
                        {showViolations && (
                            <ViolationList violations={violations} isLoading={violations === undefined} />
                        )}
                        {!showViolations && (
                            <div className="glass-card-subtle p-8 text-center">
                                <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-gray-600 font-medium">Nhấn "Xem danh sách" để tải vi phạm</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
