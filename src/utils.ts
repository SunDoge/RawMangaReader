import { IArea } from "@bmunozg/react-image-area";

export function areAreasEqual(areaA: Partial<IArea>, areaB: Partial<IArea>) {
    return (
        areaA.width === areaB.width &&
        areaA.height === areaB.height &&
        areaA.x === areaB.x &&
        areaA.y === areaB.y &&
        areaA.unit === areaB.unit
    );
}
