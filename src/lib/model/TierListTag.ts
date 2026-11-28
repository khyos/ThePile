import type { ISerializable, Serializable } from "./Serializable";

export const SERIALIZE_TYPE = 'TierListTag';

export interface ITierListTag extends ISerializable {
    id: number;
    name: string;
    color: string;
}

export class TierListTag implements Serializable<ITierListTag> {
    id: number;
    name: string;
    color: string;

    constructor(id: number, name: string, color: string) {
        this.id = id;
        this.name = name;
        this.color = color;
    }

    toJSON(): ITierListTag {
        return {
            __type: SERIALIZE_TYPE,
            id: this.id,
            name: this.name,
            color: this.color
        };
    }

    static fromJSON(json: ITierListTag): TierListTag {
        if (json.__type !== SERIALIZE_TYPE) {
            throw new Error('Invalid Type');
        }
        return new TierListTag(json.id, json.name, json.color);
    }
}
