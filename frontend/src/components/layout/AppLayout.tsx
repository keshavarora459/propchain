import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-[#FAF8F3] text-[#252B28] antialiased selection:bg-[#EAE4D9] selection:text-[#252B28]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out bg-[#FAF8F3]">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
