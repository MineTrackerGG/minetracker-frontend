interface LoadingScreenProps {
    message?: string;
    showLogo?: boolean;
    overlay?: boolean;
    className?: string;
}

export default function LoadingScreen({ 
    message = "Loading...", 
    showLogo = true, 
    overlay = true,
    className = "" 
}: LoadingScreenProps) {
    const baseClasses = overlay 
        ? "fixed inset-0 z-50 bg-black flex items-center justify-center"
        : "flex items-center justify-center min-h-screen bg-black";

    return (
        <div className={`${baseClasses} ${className}`}>
            <div className="flex flex-col items-center gap-6">
                {showLogo && (
                    <div className="flex items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/logo/logo.svg"
                            alt="MineTracker Logo"
                            className="object-cover w-32 h-32"
                        />
                    </div>
                )}
                
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
                    <p className="text-white text-lg">{message}</p>
                </div>
            </div>
        </div>
    );
}