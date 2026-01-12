import { Doc } from "../convex/_generated/dataModel";
import ViolationReportForm from "./ViolationReportForm";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import ViolationList from "./ViolationList";
import { useState } from "react";
import { Button } from "./components/ui/button";
import { Link } from "react-router-dom";
import { Trophy, TrendingUp, Star, Target, ChevronRight, Zap, Users } from "lucide-react";

export default function GradeManagerDashboard({ profile }: { profile: Doc<"userProfiles"> }) {
    const [showViolations, setShowViolations] = useState(false);
    const violations = useQuery(
        api.violations.getViolationsForGradeManager,
        showViolations ? {} : "skip"
    );
    const myPoints = useQuery(api.reportingPoints.getMyReportingPoints);
    const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;
    return (
        <div className="container mx-auto">
{/* Reporting Points Card - FIX */}
            <div className="mb-6">
                <Link to="/bang-xep-hang" className="block group">
                    <div className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-slate-900/90 text-white shadow-xl shadow-slate-200/50 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-slate-300/50 cursor-pointer border border-slate-800/50">
                        
                        {/* 1. Dynamic Background Layers */}
                        <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none" style={{ backgroundImage: noiseBg }}></div>
                        
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-violet-600/40 rounded-full blur-[80px] group-hover:bg-violet-500/50 transition-all duration-500"></div>
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/40 rounded-full blur-[80px] group-hover:bg-blue-500/50 transition-all duration-500"></div>
                        
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"></div>

                        {/* 2. Main Content */}
                        <div className="relative z-10 p-6 md:p-7">
                            <div className="flex items-start justify-between">
                                {/* Header */}
                                <div className="flex items-center gap-3">
                                    <div>
                                        <h2 className="text-lg font-bold text-white tracking-tight">Thành tích của bạn</h2>
                                        <p className="text-xs text-slate-400 font-medium">Bấm vào để xem bảng xếp hạng và đổi thưởng</p>
                                    </div>
                                </div>

                                {/* Call to Action Icon */}
                                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/20 group-hover:translate-x-1 transition-all">
                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="mt-6 flex items-end justify-between gap-4">
                                {myPoints ? (
                                    <>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3" /> Hạng
                                                </span>
                                            </div>
                                            <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 tracking-tighter">
                                                #{myPoints.rank}
                                            </div>
                                        </div>

                                        <div className="flex gap-6 pr-2">
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 flex justify-end items-center gap-1">
                                                    <Zap className="w-3 h-3 text-yellow-500" /> Điểm
                                                </div>
                                                <div className="text-xl md:text-2xl font-bold text-white tabular-nums">
                                                    {myPoints.points}
                                                </div>
                                            </div>
                                            <div className="text-right pl-6 border-l border-white/10">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 flex justify-end items-center gap-1">
                                                    <Target className="w-3 h-3 text-blue-400" /> Số báo cáo
                                                </div>
                                                <div className="text-xl md:text-2xl font-bold text-white tabular-nums">
                                                    {myPoints.totalReports}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-3 py-4">
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-600 border-t-white"></div>
                                        <span className="text-sm font-medium text-slate-400">Đang đồng bộ dữ liệu...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Decorative Sparkle */}
                        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100"></div>
                    </div>
                </Link>
            </div>

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
