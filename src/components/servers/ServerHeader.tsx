'use client';

interface ServerHeaderProps {
    servers: number;
    totalPlayers: number;
}

export default function ServerHeader({ servers, totalPlayers }: ServerHeaderProps) {
    return (
        <header
            id="header"
            className="flex flex-col gap-2 justify-center max-tablet:text-center w-full py-8 rounded-md shrink-0"
        >
            <div className="inline-flex gap-2 items-center max-tablet:justify-center text-whiteMT dark:text-secondText">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logo/logo.svg"
                    alt="MineTracker Logo"
                    className="object-cover w-4 h-4"
                />
                <span>MineTracker</span>
            </div>
            <h1
                className={`text-6xl text-white dark:text-gray-200`}
                style={{ fontFamily: 'Expose-Bold' }}
            >
                TRACKING {totalPlayers.toLocaleString() || 0} PLAYERS ON {servers.toLocaleString() || 0} MINECRAFT
                SERVERS
            </h1>
            <span className="text-lg text-whiteMT dark:text-secondText">
                Historical and real-time data for Minecraft servers
            </span>
        </header>
    );
}