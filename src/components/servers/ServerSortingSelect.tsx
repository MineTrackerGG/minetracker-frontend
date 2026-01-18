'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export type SortOption = 'most-players' | 'least-players' | 'highest-peak' | 'lowest-peak';

interface ServerSortingSelectProps {
    value: SortOption;
    onValueChange: (value: SortOption) => void;
}

export default function ServerSortingSelect({ value, onValueChange }: ServerSortingSelectProps) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="w-45">
                <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="most-players">Most Players</SelectItem>
                <SelectItem value="least-players">Least Players</SelectItem>
                <SelectItem value="highest-peak">Highest Peak</SelectItem>
                <SelectItem value="lowest-peak">Lowest Peak</SelectItem>
            </SelectContent>
        </Select>
    );
}