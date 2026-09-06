'use client';

import { Clock3, House, Lightbulb, type LucideIcon, User } from 'lucide-react';

const items: { title: string; icon: LucideIcon; active?: boolean }[] = [
  { title: 'Think', icon: House, active: true },
  { title: 'Journey', icon: Clock3 },
  { title: 'Insight', icon: Lightbulb },
  { title: 'Profile', icon: User },
];

export default function BottomNavigation() {
  return (
    <nav aria-label="하단 네비게이션" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#2a3952] bg-[#101827]/95 backdrop-blur-md text-[#9aa4b5]">
      <div className="mx-auto flex max-w-4xl justify-around py-3">
        {items.map(({ title, icon: Icon, active }) => (
          <button
            key={title}
            type="button"
            className={`flex flex-col items-center gap-1 text-xs transition-colors hover:text-[#f7f9fc] focus:outline-none ${
              active ? 'text-[#10b998] font-semibold' : 'text-[#9aa4b5]'
            }`}
          >
            <Icon size={20} />
            <span>{title}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
