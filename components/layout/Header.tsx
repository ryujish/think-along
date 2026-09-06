'use client';

import { Bell, Settings, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#2a3952] bg-[#101827]/90 backdrop-blur-md text-[#f7f9fc]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#10b998]">Think Along</h1>
          <p className="text-xs text-[#9aa4b5]">Think Better, Every Day</p>
        </div>
        <div className="flex items-center gap-2 text-[#9aa4b5]">
          <button
            type="button"
            aria-label="알림"
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[#223049] hover:text-[#f7f9fc] transition-colors focus:outline-none focus:ring-1 focus:ring-[#10b998]"
          >
            <Bell size={19} />
          </button>
          <button
            type="button"
            aria-label="설정"
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[#223049] hover:text-[#f7f9fc] transition-colors focus:outline-none focus:ring-1 focus:ring-[#10b998]"
          >
            <Settings size={19} />
          </button>
          <button
            type="button"
            aria-label="프로필"
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[#223049] hover:text-[#f7f9fc] transition-colors focus:outline-none focus:ring-1 focus:ring-[#10b998]"
          >
            <User size={19} />
          </button>
        </div>
      </div>
    </header>
  );
}
