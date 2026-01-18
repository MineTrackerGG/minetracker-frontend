'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export type TimeOption = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '1y';

interface ServerTimeSelectProps {
    value: TimeOption;
    onValueChange: (value: TimeOption) => void;
}

export default function ServerTimeSelect({ value, onValueChange }: ServerTimeSelectProps) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="w-45">
                <SelectValue placeholder="Select time range..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="6h">6 Hours</SelectItem>
                <SelectItem value="12h">12 Hours</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
        </Select>
    );
}