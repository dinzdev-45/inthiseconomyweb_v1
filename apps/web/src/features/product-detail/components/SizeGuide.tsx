import type { SizeGuide as SizeGuideData } from '../size-guide.ts';

/** A closed-by-default "Size guide" disclosure with a captioned measurement table (design D5). */
export function SizeGuide({ guide }: { guide: SizeGuideData }) {
  return (
    <details className="mt-8 border-y border-line" data-size-guide>
      <summary className="cursor-pointer py-3 text-label uppercase">Size guide</summary>
      <div className="pb-4">
        {guide.note ? <p className="mb-3 text-sm">{guide.note}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="mb-2 text-left text-sm text-stone">{guide.caption}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Size
                </th>
                {guide.columns.map((column) => (
                  <th key={column} scope="col" className="py-2 pr-4 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row) => (
                <tr key={row.size} className="border-b border-line/50">
                  <th scope="row" className="py-2 pr-4 font-semibold">
                    {row.size}
                  </th>
                  {row.values.map((value, index) => (
                    <td key={guide.columns[index]} className="py-2 pr-4">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
