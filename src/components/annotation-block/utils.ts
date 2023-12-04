import { IArea } from "@bmunozg/react-image-area";

type Size = {
  width: number;
  height: number;
};

export const processPixel2Percent = (
  containerSize: Size,
  imageSize: Size,
  areas: (Omit<IArea, "unit"> & { unit: "px" })[]
) => {
    // console.log('containerSize', containerSize);
    // console.log('imageSize', imageSize);
    const leftPadding = (containerSize.width - imageSize.width) / 2;
    const topPadding = (containerSize.height - imageSize.height) / 2;
    return areas.map(area => {
        console.log(
            'area', area, '\n',
            'leftPadding', leftPadding, '\n',
            'topPadding', topPadding, '\n',
            'imageSize', imageSize
        );
        const x = Math.max(area.x - leftPadding, 0) / imageSize.width;
        const y = Math.max(area.y - topPadding, 0) / imageSize.height;
        const width = Math.min(area.width / imageSize.width, 1 - x);
        const height = Math.min(area.height / imageSize.height, 1 - y);
        return {
            ...area,
            x,
            y,
            width,
            height,
            unit: "%" as "%"
        }
    });
}

export const processPercent2Pixel = (
    containerSize: Size,
    imageSize: Size,
    areas: (Omit<IArea, "unit"> & { unit: "%" })[]
  ) => {
      const leftPadding = (containerSize.width - imageSize.width) / 2;
      const topPadding = (containerSize.height - imageSize.height) / 2;
      return areas.map(area => ({
          ...area,
          x: area.x * imageSize.width + leftPadding,
          y: area.y * imageSize.height + topPadding,
          width: area.width * imageSize.width,
          height: area.height * imageSize.height,
          unit: "px" as "px"
      }));
  }
