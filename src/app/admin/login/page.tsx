"use client";

import { useActionState } from "react";
import { loginAdminAction, type LoginResult } from "@/actions/admin/auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { LockClosedIcon, UserIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";

function LoginForm() {
    const searchParams = useSearchParams();
    const signupSuccess = searchParams.get("signup") === "success";

    const [state, formAction, isPending] = useActionState<LoginResult | null, FormData>(
        loginAdminAction,
        null
    );

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-[#0A0A0B]">
                {/* Grid pattern */}
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,201,49,0.03) 1px, transparent 1px),
                                          linear-gradient(90deg, rgba(255,201,49,0.03) 1px, transparent 1px)`,
                        backgroundSize: "50px 50px",
                    }}
                />
                {/* Radial glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#FFC931]/5 rounded-full blur-[150px]" />
                <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-[#00CFF2]/5 rounded-full blur-[100px]" />
            </div>

            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-[#FFC931]/30 rounded-full animate-pulse"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${2 + Math.random() * 3}s`,
                        }}
                    />
                ))}
            </div>

            {/* Main Card */}
            <div className="relative z-10 w-full max-w-md mx-4">
                <div className="relative">
                    {/* Glow ring */}
                    <div className="absolute -inset-1 bg-linear-to-r from-[#FFC931]/20 via-[#00CFF2]/20 to-[#FB72FF]/20 rounded-3xl blur-xl opacity-60" />

                    {/* Card */}
                    <div className="relative bg-[#0A0A0B]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                        {/* Top accent bar */}
                        <div className="h-1 bg-linear-to-r from-[#FFC931] via-[#00CFF2] to-[#FB72FF]" />

                        <div className="p-8">
                            {/* Logo & Header */}
                            <div className="text-center mb-8">
                                <div className="relative inline-block mb-4">
                                    <div className="absolute -inset-3 bg-[#FFC931]/20 rounded-full blur-xl animate-pulse" />
                                    <div className="relative w-16 h-16 mx-auto bg-linear-to-br from-[#FFC931] to-[#FF8C00] rounded-2xl flex items-center justify-center shadow-lg shadow-[#FFC931]/30 rotate-[-8deg] hover:rotate-0 transition-transform duration-300">
                                        <span className="text-3xl">🧇</span>
                                    </div>
                                </div>
                                <h1 className="text-3xl font-bold text-white mb-1 font-display tracking-tight">
                                    Welcome Back
                                </h1>
                                <p className="text-white/50 text-sm font-display">
                                    Sign in to the Admin Dashboard
                                </p>
                            </div>

                            {/* Success Message */}
                            {signupSuccess && (
                                <div className="mb-6 p-4 bg-[#14B985]/10 border border-[#14B985]/30 rounded-xl flex items-center gap-3">
                                    <CheckCircleIcon className="h-5 w-5 text-[#14B985] shrink-0" />
                                    <p className="text-[#14B985] text-sm">Account created successfully! Please sign in.</p>
                                </div>
                            )}

                            {/* Form */}
                            <form action={formAction} className="space-y-5">
                                {/* Username */}
                                <div className="space-y-2">
                                    <label htmlFor="username" className="block text-sm font-medium text-white/70 font-display uppercase tracking-wider">
                                        Username
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <UserIcon className="h-5 w-5 text-white/30 group-focus-within:text-[#FFC931] transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            id="username"
                                            name="username"
                                            autoComplete="username"
                                            required
                                            disabled={isPending}
                                            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931]/50 transition-all duration-200 disabled:opacity-50"
                                            placeholder="Enter your username"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <label htmlFor="password" className="block text-sm font-medium text-white/70 font-display uppercase tracking-wider">
                                        Password
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <LockClosedIcon className="h-5 w-5 text-white/30 group-focus-within:text-[#FFC931] transition-colors" />
                                        </div>
                                        <input
                                            type="password"
                                            id="password"
                                            name="password"
                                            autoComplete="current-password"
                                            required
                                            disabled={isPending}
                                            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931]/50 transition-all duration-200 disabled:opacity-50"
                                            placeholder="Enter your password"
                                        />
                                    </div>
                                </div>

                                {/* Error Message */}
                                {state && !state.success && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                                        <ExclamationTriangleIcon className="h-5 w-5 text-red-400 shrink-0" />
                                        <p className="text-red-400 text-sm">{state.error}</p>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="relative w-full group"
                                >
                                    <div className="absolute -inset-0.5 bg-linear-to-r from-[#FFC931] to-[#FF8C00] rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300" />
                                    <div className="relative flex items-center justify-center gap-2 py-4 px-6 bg-linear-to-r from-[#FFC931] to-[#FF8C00] text-black font-bold rounded-xl shadow-lg shadow-[#FFC931]/20 hover:shadow-[#FFC931]/40 transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:transform-none">
                                        {isPending ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                <span>Signing in...</span>
                                            </>
                                        ) : (
                                            <>
                                                <SparklesIcon className="h-5 w-5" />
                                                <span>Sign In</span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            </form>

                            {/* Footer Link */}
                            <div className="mt-6 text-center">
                                <Link
                                    href="/admin/signup"
                                    className="text-sm text-white/50 hover:text-[#FFC931] transition-colors font-display"
                                >
                                    Need an account? <span className="text-[#FFC931]">Sign up</span>
                                </Link>
                            </div>
                        </div>

                        {/* Bottom security badge */}
                        <div className="px-8 py-4 bg-white/3 border-t border-white/5 flex items-center justify-center gap-2">
                            <LockClosedIcon className="h-4 w-4 text-[#14B985]" />
                            <span className="text-xs text-white/40 font-display">Secure admin access only</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0A0A0B]" />}>
            <LoginForm />
        </Suspense>
    );
}
