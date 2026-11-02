import { isIos } from '../install'

const FILE_NAME = 'work-plan.pdf'

function pdfFile(pdf: string): File {
  return new File([pdf], FILE_NAME, { type: 'application/pdf' })
}

/** iPhones ignore window.print() in an installed app, and Safari blocks a second press. */
export function sharesPdf(): boolean {
  if (!isIos(navigator) || typeof navigator.canShare !== 'function') return false
  return navigator.canShare({ files: [pdfFile('')] })
}

export function sharePdf(pdf: string): Promise<void> {
  return navigator.share({ files: [pdfFile(pdf)] })
}
