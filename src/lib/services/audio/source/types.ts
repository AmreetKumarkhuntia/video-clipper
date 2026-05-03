export interface AudioSource {
  readonly name: string;

  fetchAudio(videoId: string, outputDir: string): Promise<string>;
}
