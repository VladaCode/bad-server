export interface Column {
    title: string
    dataIndex: string
    key: string
    extraClassHeaderCell?: string
    extraClassTableCell?: string
     
    render?: (row: any) => JSX.Element
}

export interface DataRow {
     
    [key: string]: any // Для поддержки любых дополнительных полей
}
