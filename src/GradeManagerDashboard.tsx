import { Doc } from "../convex/_generated/dataModel";
    import ViolationReportForm from "./ViolationReportForm";
    import { useQuery } from "convex/react";
    import { api } from "../convex/_generated/api";
    import ViolationList from "./ViolationList";

    export default function GradeManagerDashboard({ profile }: { profile: Doc<"userProfiles"> }) {
        const violations = useQuery(api.violations.getViolationsForGradeManager);

        return (
            <div className="container mx-auto">
                <h2 className="text-2xl font-bold mb-4 border-b pb-2">Bảng điều khiển Quản lý Khối {profile.grade}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                    <div className="lg:col-span-1">
                        <h3 className="text-xl font-semibold mb-3">Báo cáo Vi phạm mới</h3>
                        <ViolationReportForm />
                    </div>
                    <div className="lg:col-span-2">
                        <h3 className="text-xl font-semibold mb-3">Vi phạm trong Khối của bạn</h3>
                        <ViolationList violations={violations} isLoading={violations === undefined} />
                    </div>
                </div>
            </div>
        );
    }
