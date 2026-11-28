import { ArtifactType } from "./Artifact";
import type { ISerializable, Serializable } from "./Serializable";
import { Tier, type ITier } from "./Tier";
import { TierListItem, type ITierListItem } from "./TierListItem";
import { TierListTag, type ITierListTag } from "./TierListTag";

export const SERIALIZE_TYPE = 'TierList';

export interface ITierList extends ISerializable {
    id: number;
    userId: number;
    backlogId: number | null;
    artifactType: ArtifactType;
    title: string;
    isStandalone: boolean;
    tiers: ITier[];
    unranked: ITierListItem[];
    tags: ITierListTag[];
}

export class TierList implements Serializable<ITierList> {
    id: number;
    userId: number;
    backlogId: number | null;
    artifactType: ArtifactType;
    title: string;
    isStandalone: boolean;
    tiers: Tier[];
    unranked: TierListItem[];
    tags: TierListTag[];

    constructor(
        id: number,
        userId: number,
        backlogId: number | null,
        artifactType: ArtifactType,
        title: string,
        isStandalone: boolean = false,
        tiers: Tier[] = [],
        unranked: TierListItem[] = [],
        tags: TierListTag[] = []
    ) {
        this.id = id;
        this.userId = userId;
        this.backlogId = backlogId;
        this.artifactType = artifactType;
        this.title = title;
        this.isStandalone = isStandalone;
        this.tiers = tiers;
        this.unranked = unranked;
        this.tags = tags;
    }

    toJSON(): ITierList {
        return {
            __type: SERIALIZE_TYPE,
            id: this.id,
            userId: this.userId,
            backlogId: this.backlogId,
            artifactType: this.artifactType,
            title: this.title,
            isStandalone: this.isStandalone,
            tiers: this.tiers.map(tier => tier.toJSON()),
            unranked: this.unranked.map(item => item.toJSON()),
            tags: this.tags.map(tag => tag.toJSON()),
        };
    }

    static fromJSON(json: ITierList): TierList {
        if (json.__type !== SERIALIZE_TYPE) {
            throw new Error('Invalid Type');
        }
        return new TierList(
            json.id,
            json.userId,
            json.backlogId,
            json.artifactType,
            json.title,
            json.isStandalone,
            json.tiers.map(tier => Tier.fromJSON(tier)),
            json.unranked.map(item => TierListItem.fromJSON(item)),
            (json.tags ?? []).map(tag => TierListTag.fromJSON(tag))
        );
    }
}
