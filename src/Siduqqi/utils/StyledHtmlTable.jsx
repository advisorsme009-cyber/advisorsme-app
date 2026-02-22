import React from 'react';
import parse, { domToReact } from 'html-react-parser';
import { CorporateTableTheme } from './CorporateTableTheme';

const StyledHtmlTable = ({ html }) => {
  if (!html) return null;

  const options = {
    replace: (domNode) => {
      // Style <table>
      if (domNode.name === 'table') {
        const style = { 
            ...CorporateTableTheme.table,
            marginBottom: '1rem',
            // If the original HTML has specific widths or borders, we might want to override or respect them.
            // For consistency, we enforce our theme.
        };
        return (
          <div style={CorporateTableTheme.container}>
             <table style={style}>
               {domToReact(domNode.children, options)}
             </table>
          </div>
        );
      }

      // Style <thead>
      if (domNode.name === 'thead') {
          return <thead>{domToReact(domNode.children, options)}</thead>;
      }

      // Style <tbody>
      if (domNode.name === 'tbody') {
          return <tbody>{domToReact(domNode.children, options)}</tbody>;
      }

      // Style <tr>
      if (domNode.name === 'tr') {
        // We need index to do striping, but domNode doesn't give us index directly in a simple way
        // during streaming parse. However, we can just apply a bottom border.
        // Or if we want strict striping, we might need a counter or just rely on CSS :nth-child if we could use CSS classes.
        // Since we are using inline styles, let's just use a generic row style or try to infer.
        // For simplicity in this parser, we might just default to white background and let hover effects (if added later) handle it,
        // or just apply a border.
        // Let's stick to simple borders for now as fully replicating logic is hard without index context.
        return <tr style={{ borderBottom: '1px solid #e2e8f0' }}>{domToReact(domNode.children, options)}</tr>;
      }

      // Style <th>
      if (domNode.name === 'th') {
        return (
          <th style={CorporateTableTheme.headerCell}>
            {domToReact(domNode.children, options)}
          </th>
        );
      }

      // Style <td>
      if (domNode.name === 'td') {
        return (
          <td style={CorporateTableTheme.bodyCell}>
            {domToReact(domNode.children, options)}
          </td>
        );
      }
    },
  };

  return <>{parse(html, options)}</>;
};

export default StyledHtmlTable;
