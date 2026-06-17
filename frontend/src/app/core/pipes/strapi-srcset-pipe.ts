import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

type StrapiImageFormat = {
  url: string;
  width?: number;
};

type StrapiImageWithFormats = {
  url?: string;
  width?: number;
  formats?: Record<string, StrapiImageFormat | undefined>;
};

@Pipe({
  name: 'strapiSrcset',
  standalone: true,
})
export class StrapiSrcsetPipe implements PipeTransform {
  transform(image: StrapiImageWithFormats | null | undefined): string {
    if (!image || !image.url) {
      return '';
    }

    const formats = image.formats;
    if (!formats) {
      return this.getFullUrl(image.url);
    }

    const srcset: string[] = [];

    this.addFormat(srcset, formats['large']);
    this.addFormat(srcset, formats['medium']);
    this.addFormat(srcset, formats['small']);
    this.addFormat(srcset, formats['thumbnail']);

    // Add the original image as the largest option
    srcset.push(`${this.getFullUrl(image.url)} ${image.width || 2000}w`);

    return srcset.join(', ');
  }

  private getFullUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${environment.apiUrl}${url}`;
  }

  private addFormat(
    srcset: string[],
    format: StrapiImageFormat | undefined,
  ): void {
    if (!format?.url || !format.width) {
      return;
    }

    srcset.push(`${this.getFullUrl(format.url)} ${format.width}w`);
  }
}
