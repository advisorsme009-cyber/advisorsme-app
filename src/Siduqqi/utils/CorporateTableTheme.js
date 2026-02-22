export const CorporateTableTheme = {
    container: {
        fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        backgroundColor: '#fff',
        overflowX: 'auto',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
        color: '#333',
        minWidth: '600px', // Prevent squishing on small screens
    },
    // The Dark Blue Header for main headers
    mainHeader: {
        backgroundColor: '#1F559B', // THEME BLUE
        color: '#ffffff',
        padding: '16px',
        textAlign: 'left',
        fontWeight: 'bold',
        borderRight: '1px solid rgba(255,255,255,0.1)',
    },
    // The Year/Sub Headers
    subHeader: {
        backgroundColor: '#ffffff',
        color: '#333',
        padding: '12px 16px',
        textAlign: 'center',
        fontWeight: '600',
        borderBottom: '2px solid #e0e0e0',
        borderRight: '1px solid #f0f0f0',
    },
    // Row Styles
    rowOdd: {
        backgroundColor: '#F7FAFC', // Light blue/gray stripe
    },
    rowEven: {
        backgroundColor: '#ffffff',
    },
    // Cell Styles
    cellLabel: {
        padding: '14px 16px',
        textAlign: 'left',
        fontWeight: '600',
        color: '#2d3748',
        borderBottom: '1px solid #edf2f7',
        borderRight: '1px solid #edf2f7',
    },
    cellValue: {
        padding: '14px 16px',
        textAlign: 'center',
        color: '#4a5568',
        borderBottom: '1px solid #edf2f7',
        borderRight: '1px solid #edf2f7',
        fontVariantNumeric: 'tabular-nums', // Better alignment for numbers
    },
    // For HTML Table parsing where we might just have th/td
    headerCell: {
        backgroundColor: '#1F559B',
        color: '#ffffff',
        padding: '12px 16px',
        fontWeight: '600',
        textAlign: 'left',
        border: '1px solid #163C6E',
    },
    bodyCell: {
        padding: '12px 16px',
        border: '1px solid #e2e8f0',
        color: '#4a5568',
    }
};
