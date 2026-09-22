'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

function fmtDate(s) {
  if (!s) return ''
  try {
    const d = new Date(s)
    if (isNaN(d)) return s
    return d.toLocaleDateString('pt-BR')
  } catch { return s }
}

function statusLabel(s, days) {
  if (s === 'expired') return 'VENCIDO'
  if (s === 'critical') return `${days}d (crítico)`
  if (s === 'warning_30') return `${days}d`
  if (s === 'warning_60') return `${days}d`
  if (s === 'warning_90') return `${days}d`
  if (s === 'ok') return `${days}d`
  return '—'
}

export function exportToPDF(medicines) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  // Header
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('HomeMed - Farmácia Doméstica', 40, 32)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Relatório gerado em ${new Date().toLocaleString('pt-BR')}`, 40, 48)

  // Summary
  const total = medicines.length
  const expired = medicines.filter(m => m.expiry_status === 'expired').length
  const expiring = medicines.filter(m => ['critical', 'warning_30', 'warning_60', 'warning_90'].includes(m.expiry_status)).length

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(11)
  doc.text(`Total: ${total}   |   Vencidos: ${expired}   |   Vencendo em breve: ${expiring}`, 40, 82)

  // Table
  const rows = medicines.map(m => [
    m.nome_comercial || '',
    m.principio_ativo || m.nome_generico || '',
    m.concentracao || '',
    m.forma_farmaceutica || '',
    m.categoria || '',
    String(m.quantidade ?? ''),
    m.local || '',
    fmtDate(m.data_validade),
    statusLabel(m.expiry_status, m.days_until_expiry),
    m.precisa_receita ? 'Sim' : 'Não',
  ])

  autoTable(doc, {
    startY: 100,
    head: [['Nome', 'Princípio ativo', 'Concentr.', 'Forma', 'Categoria', 'Qtd', 'Local', 'Validade', 'Status', 'Receita']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 249, 255] },
    styles: { fontSize: 9, cellPadding: 5 },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const med = medicines[data.row.index]
      if (data.column.index === 8) {
        if (med.expiry_status === 'expired') {
          data.cell.styles.fillColor = [254, 226, 226]
          data.cell.styles.textColor = [153, 27, 27]
          data.cell.styles.fontStyle = 'bold'
        } else if (med.expiry_status === 'critical' || med.expiry_status === 'warning_30') {
          data.cell.styles.fillColor = [255, 237, 213]
          data.cell.styles.textColor = [154, 52, 18]
        }
      }
    },
  })

  doc.save(`homemed-farmacia-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function exportToExcel(medicines) {
  const rows = medicines.map(m => ({
    'Nome comercial': m.nome_comercial || '',
    'Nome genérico': m.nome_generico || '',
    'Princípio ativo': m.principio_ativo || '',
    'Laboratório': m.laboratorio || '',
    'Concentração': m.concentracao || '',
    'Forma farmacêutica': m.forma_farmaceutica || '',
    'Categoria': m.categoria || '',
    'Classe terapêutica': m.classe_terapeutica || '',
    'Quantidade': m.quantidade ?? '',
    'Quantidade mínima': m.quantidade_minima ?? '',
    'Local': m.local || '',
    'Lote': m.lote || '',
    'Data fabricação': fmtDate(m.data_fabricacao),
    'Data validade': fmtDate(m.data_validade),
    'Status validade': statusLabel(m.expiry_status, m.days_until_expiry),
    'Dias até vencer': m.days_until_expiry ?? '',
    'Precisa receita': m.precisa_receita ? 'Sim' : 'Não',
    'Uso contínuo': m.uso_continuo ? 'Sim' : 'Não',
    'Para que serve': m.para_que_serve || '',
    'Código de barras': m.codigo_barras || '',
    'Observações': m.observacoes || '',
    'Cadastrado em': fmtDate(m.created_at),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  // Column widths
  ws['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 40 }, { wch: 18 }, { wch: 30 }, { wch: 14 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'HomeMed')
  XLSX.writeFile(wb, `homemed-farmacia-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportToCSV(medicines) {
  const rows = medicines.map(m => ({
    'Nome comercial': m.nome_comercial || '',
    'Nome genérico': m.nome_generico || '',
    'Princípio ativo': m.principio_ativo || '',
    'Laboratório': m.laboratorio || '',
    'Concentração': m.concentracao || '',
    'Forma': m.forma_farmaceutica || '',
    'Categoria': m.categoria || '',
    'Quantidade': m.quantidade ?? '',
    'Local': m.local || '',
    'Validade': fmtDate(m.data_validade),
    'Status': statusLabel(m.expiry_status, m.days_until_expiry),
    'Receita': m.precisa_receita ? 'Sim' : 'Não',
    'Código de barras': m.codigo_barras || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
  // BOM for Excel accents
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `homemed-farmacia-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
