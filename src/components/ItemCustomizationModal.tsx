import { useState } from "react";
import { X, Palette, Sparkles, Save, RotateCcw } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

type ItemCustomizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  purchase: any;
  item: any;
  userProfile?: any; // Add user profile for demo
};

// Available icons and colors for customization
const AVAILABLE_ICONS = [
  { name: "Star", emoji: "⭐", lucide: "Star" },
  { name: "Heart", emoji: "❤️", lucide: "Heart" },
  { name: "Fire", emoji: "🔥", lucide: "Flame" },
  { name: "Lightning", emoji: "⚡", lucide: "Zap" },
  { name: "Crown", emoji: "👑", lucide: "Crown" },
  { name: "Diamond", emoji: "💎", lucide: "Diamond" },
  { name: "Sparkles", emoji: "✨", lucide: "Sparkles" },
  { name: "Trophy", emoji: "🏆", lucide: "Award" },
  { name: "Medal", emoji: "🎖️", lucide: "Badge" },
  { name: "Rocket", emoji: "🚀", lucide: "Rocket" },
  { name: "Magic", emoji: "🪄", lucide: "Wand" },
  { name: "Gem", emoji: "💍", lucide: "Gem" },
  { name: "Unicorn", emoji: "🦄", lucide: "Sparkles" },
  { name: "Rainbow", emoji: "🌈", lucide: "Rainbow" },
  { name: "Sun", emoji: "☀️", lucide: "Sun" },
  { name: "Moon", emoji: "🌙", lucide: "Moon" },
  { name: "Butterfly", emoji: "🦋", lucide: "Butterfly" },
  { name: "Flower", emoji: "🌸", lucide: "Flower" },
  { name: "Cat", emoji: "🐱", lucide: "Cat" },
  { name: "Dog", emoji: "🐶", lucide: "Dog" },
  { name: "Panda", emoji: "🐼", lucide: "Panda" },
  { name: "Fox", emoji: "🦊", lucide: "Fox" },
  { name: "Bear", emoji: "🐻", lucide: "Bear" },
  { name: "Koala", emoji: "🐨", lucide: "Koala" },
];

const AVAILABLE_COLORS = [
  { name: "Emerald", from: "emerald-600", to: "emerald-700", preview: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-600" },
  { name: "Blue", from: "blue-600", to: "blue-700", preview: "bg-blue-600", text: "text-blue-600", border: "border-blue-600" },
  { name: "Purple", from: "purple-600", to: "purple-700", preview: "bg-purple-600", text: "text-purple-600", border: "border-purple-600" },
  { name: "Pink", from: "pink-600", to: "pink-700", preview: "bg-pink-600", text: "text-pink-600", border: "border-pink-600" },
  { name: "Orange", from: "orange-600", to: "orange-700", preview: "bg-orange-600", text: "text-orange-600", border: "border-orange-600" },
  { name: "Red", from: "red-600", to: "red-700", preview: "bg-red-600", text: "text-red-600", border: "border-red-600" },
  { name: "Amber", from: "amber-600", to: "amber-700", preview: "bg-amber-600", text: "text-amber-600", border: "border-amber-600" },
  { name: "Teal", from: "teal-600", to: "teal-700", preview: "bg-teal-600", text: "text-teal-600", border: "border-teal-600" },
  { name: "Cyan", from: "cyan-600", to: "cyan-700", preview: "bg-cyan-600", text: "text-cyan-600", border: "border-cyan-600" },
  { name: "Rose", from: "rose-600", to: "rose-700", preview: "bg-rose-600", text: "text-rose-600", border: "border-rose-600" },
  { name: "Violet", from: "violet-600", to: "violet-700", preview: "bg-violet-600", text: "text-violet-600", border: "border-violet-600" },
  { name: "Lime", from: "lime-600", to: "lime-700", preview: "bg-lime-600", text: "text-lime-600", border: "border-lime-600" },
];

export default function ItemCustomizationModal({ isOpen, onClose, purchase, item, userProfile }: ItemCustomizationModalProps) {
  const updateCustomization = useMutation(api.shop.updateCustomization);
  
  // Initialize state from existing customization or defaults
  const [selectedIcon, setSelectedIcon] = useState(
    purchase?.customization?.icon || AVAILABLE_ICONS[0].emoji
  );
  const [selectedColor, setSelectedColor] = useState(() => {
    const existing = purchase?.customization?.colorFrom;
    return AVAILABLE_COLORS.find(c => c.from === existing) || AVAILABLE_COLORS[0];
  });
  const [customLabel, setCustomLabel] = useState(
    purchase?.customization?.label || "Nhập bởi"
  );
  const [labelError, setLabelError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const validateLabel = (label: string): string | null => {
    if (label.length > 15) {
      return "Nhãn không được vượt quá 15 ký tự";
    }
    if (label.toLowerCase().includes("admin")) {
      return "Nhãn không được chứa từ 'admin'";
    }
    return null;
  };

  const handleLabelChange = (value: string) => {
    setCustomLabel(value);
    const error = validateLabel(value);
    setLabelError(error);
  };

  const handleSave = async () => {
    // Validate label before saving
    const labelValidationError = validateLabel(customLabel);
    if (labelValidationError) {
      setLabelError(labelValidationError);
      toast.error(labelValidationError);
      return;
    }

    try {
      setIsSaving(true);
      
      const customization = {
        icon: selectedIcon,
        colorFrom: selectedColor.from,
        colorTo: selectedColor.to,
        showPublic: true, // Always public
        label: customLabel,
        type: "reporter_badge"
      };

      const result = await updateCustomization({
        purchaseId: purchase._id,
        customization
      });

      if (result.success) {
        toast.success("Đã lưu tùy chỉnh thành công!");
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Customization error:", error);
      toast.error("Có lỗi xảy ra khi lưu tùy chỉnh");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedIcon(AVAILABLE_ICONS[0].emoji);
    setSelectedColor(AVAILABLE_COLORS[0]);
    setCustomLabel("Nhập bởi");
    setLabelError(null);
  };

  // Get current color object for preview
  const currentColor = selectedColor;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Tùy chỉnh thẻ tên</h2>
              <p className="text-sm text-slate-600">Thiết kế thẻ tên độc quyền của bạn</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Preview */}
          <div className="bg-slate-50 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Xem trước trong báo cáo vi phạm
            </h3>
            
            {/* Mock Violation Item - Overview Only */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-3 cursor-pointer select-none group bg-white hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  {/* Badge Lớp & Điểm */}
                  <div className="flex flex-col items-center justify-center gap-1 min-w-[2.5rem]">
                    <span className="font-bold text-slate-700 text-xs">12A1</span>
                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-4 bg-red-50 text-red-600 border border-red-100 font-bold rounded-md text-[10px] px-1">
                      -5
                    </span>
                  </div>
                  
                  {/* Thông tin chính */}
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                      Nguyễn Văn A
                    </span>
                    <span className="text-xs text-slate-500 truncate pr-2">
                      Không mặc đồng phục
                    </span>
                  </div>
                  
                  {/* Custom Badge Preview */}
                  <div className="flex items-center ml-auto pl-2">
                    <div className="group relative flex items-center">
                      <div className={`absolute -inset-1 ${selectedColor.preview}/20 rounded-full blur-sm opacity-100 transition duration-500`}></div>
                      <div className={`relative flex items-center bg-white border ${selectedColor.border} shadow-lg rounded-lg sm:rounded-full py-1 px-2 gap-1.5`}>
                        <span className={`${selectedColor.text} text-sm`}>{selectedIcon}</span>
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                          <span className={`text-[8px] font-extrabold tracking-wider ${selectedColor.text} uppercase leading-none border-b border-slate-100 pb-0.5 mb-0.5 sm:border-b-0 sm:pb-0 sm:mb-0 sm:border-r ${selectedColor.border} sm:pr-1.5 sm:py-0.5 w-fit`}>
                            {customLabel}
                          </span>
                          <span className="text-[10px] font-bold text-slate-700 leading-none truncate max-w-[80px]">
                            {userProfile?.fullName || "Tên của bạn"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toggle Icon */}
                <div className="text-slate-400 pl-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Public Display Note - Always shown since it's always public */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium">
                  Thẻ tên sẽ hiển thị công khai cho tất cả mọi người.
                </span>
              </div>
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Chọn biểu tượng ({AVAILABLE_ICONS.length} lựa chọn)</h3>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg">
              {AVAILABLE_ICONS.map((icon) => (
                <button
                  key={icon.name}
                  onClick={() => setSelectedIcon(icon.emoji)}
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl transition-all hover:scale-105 ${
                    selectedIcon === icon.emoji
                      ? `${selectedColor.border} ${selectedColor.preview}/10`
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  title={icon.name}
                >
                  {icon.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Chọn màu sắc ({AVAILABLE_COLORS.length} lựa chọn)</h3>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color)}
                  className={`w-12 h-12 rounded-xl border-2 ${color.preview} transition-all hover:scale-105 ${
                    selectedColor.name === color.name
                      ? 'border-slate-800 ring-2 ring-slate-300'
                      : 'border-slate-200'
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Custom Label */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Nhãn tùy chỉnh</h3>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Nhập bởi"
              maxLength={15}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                labelError ? 'border-red-400 bg-red-50' : 'border-slate-200'
              }`}
            />
            <div className="flex justify-between items-center mt-1">
              <div className="text-xs">
                {labelError ? (
                  <span className="text-red-500 font-medium">{labelError}</span>
                ) : (
                  <span className="text-slate-500">Tối đa 15 ký tự, không chứa "admin"</span>
                )}
              </div>
              <span className={`text-xs font-mono ${
                customLabel.length > 15 ? 'text-red-500' : 'text-slate-400'
              }`}>
                {customLabel.length}/15
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Đặt lại
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !!labelError}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Đang lưu...
                </>
              ) : (
                <>
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}