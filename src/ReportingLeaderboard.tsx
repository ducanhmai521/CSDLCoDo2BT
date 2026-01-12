import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Trophy, Medal, Award, Star, TrendingUp, Users, Target, Zap, Shield, ArrowLeft, ShoppingBag, Settings, Check, CreditCard, Sparkles, Gift, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import ItemCustomizationModal from "./components/ItemCustomizationModal";

// Noise Texture (Giữ nguyên)
const NoiseOverlay = () => (
  <div 
    className="fixed inset-0 pointer-events-none z-0 opacity-[0.04]"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
    }}
  />
);

// Mesh Background (Giữ nguyên)
const MeshBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-slate-100">
    <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
    <div className="absolute top-[10%] right-[-10%] w-[400px] h-[400px] bg-blue-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
    <div className="absolute -bottom-8 left-20 w-[400px] h-[400px] bg-pink-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
  </div>
);

export default function ReportingLeaderboard() {
  const leaderboard = useQuery(api.reportingPoints.getReportingLeaderboard, { limit: 10 });
  const myPoints = useQuery(api.reportingPoints.getMyReportingPoints);
  const shopItems = useQuery(api.shop.getShopItems);
  const userPurchases = useQuery(api.shop.getUserPurchases);
  const myProfile = useQuery(api.users.getMyProfile);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'shop'>('leaderboard');
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);
  const [customizationModal, setCustomizationModal] = useState<{
    isOpen: boolean;
    purchase: any;
    item: any;
  }>({
    isOpen: false,
    purchase: null,
    item: null,
  });
  
  const purchaseItem = useMutation(api.shop.purchaseItem);

  const handlePurchase = async (itemId: string) => {
    try {
      setPurchasingItemId(itemId);
      const result = await purchaseItem({ itemId: itemId as any });
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Có lỗi xảy ra khi mua sản phẩm');
    } finally {
      setPurchasingItemId(null);
    }
  };

  const handleUseItem = (purchase: any) => {
    // Find the corresponding shop item
    const item = shopItems?.find(item => item._id === purchase.itemId);
    
    if (!item) {
      toast.error('Không tìm thấy thông tin sản phẩm');
      return;
    }

    // Handle different item types
    switch (item.category) {
      case 'customization':
        setCustomizationModal({
          isOpen: true,
          purchase,
          item,
        });
        break;
      // Add more cases for future item types
      default:
        toast.info('Loại sản phẩm này chưa được hỗ trợ');
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="relative flex items-center justify-center w-8 h-8">
             <div className="absolute inset-0 bg-yellow-400 blur-sm opacity-40 rounded-full" />
             <Trophy className="w-5 h-5 text-yellow-600 relative z-10" />
          </div>
        );
      case 2:
        return <Medal className="w-5 h-5 text-slate-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-slate-400 font-mono font-bold text-xs">#{rank}</span>;
    }
  };

  return (
    <div className="min-h-screen text-slate-800 font-sans relative selection:bg-indigo-100">
      <MeshBackground />
      <NoiseOverlay />

      {/* Navbar */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 border-b border-slate-200/60 h-14">
        <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-800">CSDLCoDo2BT</span>
            </div>
            <Link
              to="/"
              className="group flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Quay lại
            </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 relative z-10">
        
        {/* Header Section with Tab Switcher */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {activeTab === 'leaderboard' ? 'Bảng xếp hạng' : 'Đổi điểm'} 
                </h1>
                <p className="text-slate-500 text-sm mt-2 font-medium">
                    {activeTab === 'leaderboard' 
                        ? 'Vinh danh những chiến binh xuất sắc.' 
                        : 'Sử dụng điểm tích lũy để đổi lấy quyền lợi đặc biệt.'}
                </p>
            </div>
            
            {/* === PRO TAB SWITCHER === */}
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 flex relative z-10">
                <button
                    onClick={() => setActiveTab('leaderboard')}
                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                        activeTab === 'leaderboard'
                            ? 'bg-slate-100 text-slate-900 shadow-inner'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Trophy className={`w-4 h-4 ${activeTab === 'leaderboard' ? 'text-yellow-600' : ''}`} />
                    Xếp Hạng
                </button>
                
                <button
                    onClick={() => setActiveTab('shop')}
                    className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 overflow-hidden ${
                        activeTab === 'shop'
                            ? 'text-white shadow-md'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    {/* Active Background for Shop Tab */}
                    {activeTab === 'shop' && (
                        <div className="absolute inset-0 bg-slate-900">
                             <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-sm"></div>
                        </div>
                    )}
                    
                    <span className="relative z-10 flex items-center gap-2">
                        <ShoppingBag className={`w-4 h-4 ${activeTab === 'shop' ? 'text-indigo-300' : ''}`} />
                        Đổi Điểm
                    </span>

                    {/* Notification Dot */}
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-white"></span>
                </button>
            </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'leaderboard' ? (
          /* Leaderboard View */
          <>
            {/* My Stats - Compact Grid */}
            {myPoints && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {/* Card 1: Rank */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex flex-col justify-between h-28 relative overflow-hidden group">
                    <div className="absolute -right-2 -bottom-4 opacity-[0.08] group-hover:opacity-15 transition-opacity">
                        <Trophy className="w-24 h-24 -rotate-12" />
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <TrendingUp className="w-3.5 h-3.5" /> Thứ hạng
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-800 tracking-tighter">#{myPoints.rank}</span>
                    </div>
                </div>

                {/* Card 2: Points */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg shadow-slate-200/50 flex flex-col justify-between h-28 relative overflow-hidden text-white group">
                    <div className="absolute -right-2 -bottom-4 opacity-20 group-hover:opacity-30 transition-opacity">
                        <Zap className="w-24 h-24 -rotate-12 text-yellow-400" />
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <Star className="w-3.5 h-3.5" /> Tổng điểm
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-white tracking-tighter">{myPoints.points}</span>
                        <span className="text-xs text-slate-400 font-medium">pts</span>
                    </div>
                </div>

                {/* Card 3: Reports */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-md transition-all flex flex-col justify-between h-28 relative overflow-hidden group">
                    <div className="absolute -right-2 -bottom-4 opacity-[0.08] group-hover:opacity-15 transition-opacity">
                        <Target className="w-24 h-24 -rotate-12" />
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <Shield className="w-3.5 h-3.5" /> Đã báo cáo
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-800 tracking-tighter">{myPoints.totalReports}</span>
                        <span className="text-xs text-slate-500 font-medium">lần</span>
                    </div>
                </div>
            </div>
            )}
            
            {/* Leaderboard Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-400" />
                    <h2 className="text-base font-bold text-slate-800">Bảng xếp hạng</h2>
                </div>
                <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                    {leaderboard?.length || 0} chiến binh
                </div>
                </div>

                <div className="relative min-h-[300px]">
                {leaderboard === undefined ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-800 mb-3"></div>
                    <p className="text-xs text-slate-400 font-medium">Đang tải...</p>
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <Trophy className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">Chưa có dữ liệu</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                        <th className="px-5 py-3 w-16 text-center">#</th>
                        <th className="px-5 py-3">Thành viên</th>
                        <th className="px-5 py-3 text-center">Lớp</th>
                        <th className="px-5 py-3 text-right">Điểm</th>
                        <th className="px-5 py-3 text-right">Báo cáo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                        {leaderboard.map((user: any) => {
                        const isTop3 = user.rank <= 3;
                        return (
                            <tr key={user.userId} className="group hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 text-center">
                                <div className="flex justify-center">{getRankIcon(user.rank)}</div>
                            </td>
                            <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                                        isTop3 ? 'bg-gradient-to-b from-yellow-50 to-orange-50 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                        {user.fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <span className={`font-semibold truncate max-w-[120px] md:max-w-none ${isTop3 ? 'text-slate-900' : 'text-slate-700'}`}>
                                        {user.fullName}
                                    </span>
                                </div>
                            </td>
                            <td className="px-5 py-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                {user.className}
                                </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                                <span className={`font-bold tabular-nums ${user.rank === 1 ? 'text-yellow-600 text-base' : 'text-slate-900'}`}>
                                    {user.points}
                                </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                                <span className="text-slate-500 tabular-nums text-xs font-medium bg-slate-50 px-1.5 py-0.5 rounded">
                                    {user.totalReports}
                                </span>
                            </td>
                            </tr>
                        );
                        })}
                    </tbody>
                    </table>
                )}
                </div>
            </div>
          </>
        ) : (
          /* Shop Content */
          <div className="space-y-6">
            {/* === PRO WALLET CARD DESIGN === */}
            <div className="relative w-full h-56 md:h-64 rounded-3xl overflow-hidden shadow-2xl shadow-slate-300 transition-all hover:scale-[1.01] duration-500 group">
                {/* Background: Black Card style with Tech glow */}
                <div className="absolute inset-0 bg-slate-950">
                    {/* Aurora gradients */}
                    <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[100px] mix-blend-screen animate-pulse"></div>
                    <div className="absolute bottom-[-50%] right-[-20%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[100px] mix-blend-screen animate-pulse animation-delay-2000"></div>
                    {/* Noise texture overlay */}
                    <div className="absolute inset-0 opacity-20" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}></div>
                </div>

                <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between z-10">
                    <div className="flex justify-between items-start">
                         <div className="flex items-center gap-2">
                             {/* Chip Icon simulating Credit Card Chip */}
                            <div className="w-10 h-8 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 border border-yellow-600/30 flex items-center justify-center opacity-90 shadow-sm">
                                <div className="w-full h-[1px] bg-yellow-600/40"></div>
                            </div>
                            <span className="text-slate-400 font-mono text-xs tracking-widest opacity-60">THẺ THÀNH VIÊN CODO2BT</span>
                         </div>
                         <CreditCard className="text-white/20 w-8 h-8" />
                    </div>

                    <div className="space-y-1">
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Số dư khả dụng</p>
                         <div className="flex items-baseline gap-2">
                             <h2 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tighter tabular-nums shadow-black drop-shadow-lg">
                                 {myPoints?.points || 0}
                             </h2>
                             <span className="text-lg text-yellow-400 font-bold">PTS</span>
                         </div>
                    </div>

                    <div className="flex justify-between items-end">
                        <div>
                             <p className="text-white/80 font-medium text-sm">{myPoints?.rank ? `Hạng #${myPoints.rank}` : 'Chưa xếp hạng'}</p>
                             <p className="text-white/40 text-xs mt-0.5 font-mono">**** **** **** {myPoints?.totalReports ? myPoints.totalReports.toString().padStart(4, '0') : '0000'}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                            <Sparkles className="w-5 h-5 text-yellow-300" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Shop Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {shopItems === undefined ? (
                <div className="col-span-full py-12 text-center text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-800 mb-3 mx-auto"></div>
                  Đang tải kho quà...
                </div>
              ) : shopItems.length === 0 ? (
                 <div className="col-span-full py-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Lock className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500">Chưa có vật phẩm nào được bày bán.</p>
                 </div>
              ) : (
                shopItems.map((item) => {
                  const userOwnsItem = userPurchases?.some(p => p.itemId === item._id && p.isActive);
                  const canAfford = myPoints ? myPoints.points >= item.price : false;
                  const isPurchasing = purchasingItemId === item._id;
                  
                  return (
                    <div key={item._id} className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                      {/* Item Visual Preview (Top Half) */}
                      <div className={`h-32 w-full flex items-center justify-center relative overflow-hidden
                          ${item.category === 'customization' 
                              ? 'bg-gradient-to-br from-purple-50 to-indigo-50' 
                              : 'bg-gradient-to-br from-emerald-50 to-teal-50'
                          }`}
                      >
                         {/* Abstract Patterns */}
                         <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                         
                         {/* Central Icon */}
                         <div className="relative z-10 w-14 h-14 bg-white rounded-2xl shadow-lg flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300">
                            {item.category === 'customization' ? '🎨' : '🎁'}
                         </div>

                         {/* Price Tag (Floating) */}
                         <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-700 shadow-sm border border-slate-100 flex items-center gap-1">
                             <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                             {item.price}
                         </div>
                      </div>

                      {/* Content (Bottom Half) */}
                      <div className="p-5 flex-1 flex flex-col">
                          <div className="flex-1">
                              <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{item.name}</h3>
                              <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
                          </div>
                          
                          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                              {userOwnsItem ? (
                                  <div className="w-full py-2.5 bg-green-50 text-green-600 rounded-xl flex items-center justify-center gap-2 text-sm font-bold border border-green-200 cursor-default">
                                      <Check className="w-4 h-4" /> Đã sở hữu
                                  </div>
                              ) : (
                                  <button
                                    onClick={() => handlePurchase(item._id)}
                                    disabled={!canAfford || isPurchasing}
                                    className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                                        canAfford && !isPurchasing
                                        ? 'bg-slate-900 text-white hover:bg-indigo-600 shadow-lg shadow-slate-200 hover:shadow-indigo-200'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                                  >
                                      {isPurchasing ? (
                                          <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-white"></div>
                                            Đang mua...
                                          </>
                                      ) : canAfford ? (
                                          <>Mua ngay</>
                                      ) : (
                                          <>Thiếu {item.price - (myPoints?.points || 0)} điểm</>
                                      )}
                                  </button>
                              )}
                          </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* My Purchases List */}
            {userPurchases && userPurchases.length > 0 && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mt-8">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Kho đồ của bạn
                </h3>
                <div className="space-y-3">
                  {userPurchases.map((purchase) => (
                    <div key={purchase._id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-xl">
                             📦
                         </div>
                         <div>
                            <h4 className="font-bold text-slate-800 text-sm">{purchase.item?.name}</h4>
                            <p className="text-xs text-slate-500">Đổi ngày {new Date(purchase.purchaseDate).toLocaleDateString('vi-VN')}</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => handleUseItem(purchase)}
                        className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        Sử dụng
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-12 text-center border-t border-slate-200/60 pt-8">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">CSDL Cờ đỏ THPT Số 2 Bảo Thắng</p>
              <div className="flex justify-center gap-4 text-xs font-medium text-slate-500">
                <a href="https://github.com/ducanhmai521/CSDLCoDo2BT" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 hover:underline">
                  GitHub Repository
                </a>
                <span>•</span>
                <a href="https://17022008.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 hover:underline">
                  Liên hệ Dev
                </a>
              </div>
        </div>
      </div>

      {/* Customization Modal */}
      <ItemCustomizationModal
        isOpen={customizationModal.isOpen}
        onClose={() => setCustomizationModal({ isOpen: false, purchase: null, item: null })}
        purchase={customizationModal.purchase}
        item={customizationModal.item}
        userProfile={myProfile}
      />
    </div>
  );
}