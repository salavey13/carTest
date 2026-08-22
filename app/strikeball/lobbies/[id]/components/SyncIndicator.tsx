import { FaWifi } from "react-icons/fa6";

export function SyncIndicator({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <div className="fixed top-20 left-4 z-[70] flex items-center gap-2 bg-red-950/80 border border-red-600 px-3 py-1 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.2)]">
            <FaWifi className="text-red-500 text-xs" />
            <span className="text-[9px] font-black text-red-500 tracking-widest uppercase">БУФЕР_СВЯЗИ: {count}</span>
        </div>
    );
}