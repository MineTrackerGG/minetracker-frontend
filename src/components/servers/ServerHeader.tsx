'use client';

import { useEffect, useState } from 'react';

interface ServerHeaderProps {
    servers: number;
    totalPlayers: number;
    lastUpdateTime: number | null;
}

export default function ServerHeader({ servers, totalPlayers, lastUpdateTime }: ServerHeaderProps) {
    const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number | null>(null);

    useEffect(() => {
        if (!lastUpdateTime) {
            return;
        }

        const update = () => {
            setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - lastUpdateTime) / 1000)));
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [lastUpdateTime]);

    const updateMessage =
        !lastUpdateTime || secondsSinceUpdate == null
            ? 'Waiting for live data'
            : secondsSinceUpdate === 0
                ? 'Last updated now'
                : `Last update ${secondsSinceUpdate} ${secondsSinceUpdate === 1 ? 'second' : 'seconds'} ago`;

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
            <span className="text-sm text-white/80 dark:text-gray-300">{updateMessage}</span>
        </header>
    );
}