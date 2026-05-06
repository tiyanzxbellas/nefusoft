import React from 'react';
import Navbar from '../components/Navbar';

const History = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0c] font-nunito selection:bg-[#F6CF80] selection:text-black pb-24">
      <Navbar />
      <div className="pt-24 max-w-7xl mx-auto px-6">
        <div className="mb-8 flex flex-col">
          <h2 className="text-white font-black uppercase text-lg">Riwayat Nonton</h2>
          <span className="text-[10px] text-white/50 font-bold">Lanjutkan anime yang sedang kamu tonton</span>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-16 h-16 text-white/5 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p className="text-white/40 font-bold text-sm">Belum ada riwayat tontonan</p>
        </div>
      </div>
    </div>
  );
};

export default History;