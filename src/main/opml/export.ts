import { writeFile } from 'node:fs/promises'
import { Builder } from 'xml2js'
import { listFeeds } from '../feeds/manager.js'

export async function exportOpml(filePath: string): Promise<void> {
  const feeds = await listFeeds()
  const obj = {
    opml: {
      $: { version: '2.0' },
      head: [{ title: ['Guignol feeds'], dateCreated: [new Date().toUTCString()] }],
      body: [{
        outline: feeds.map((f) => ({
          $: { type: 'rss', text: f.title, title: f.title, xmlUrl: f.url }
        }))
      }]
    }
  }
  const xml = new Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } }).buildObject(obj)
  await writeFile(filePath, xml, 'utf8')
}
