// Call the dataTables jQuery plugin
$(document).ready(function() {
  $('#dataTable').DataTable({
    // Your DataTables configuration goes here
    dom: 'Bfrtip',
    buttons: [
      {
        extend: 'print',
        text: '<i class="fas fa-print"></i> Print', // Font Awesome print icon
      }
    ]
  });

});

// $(document).ready(function() {
//   $('#dataTable').DataTable({
//     dom: 'Bfrtip',
//     buttons: [
//       {
//           extend: 'print',
//           text: 'Custom Print', // Customize the text for the print button
//           className: 'btn btn-success', // Add the Bootstrap button class to the print button
//           customize: function(win) {
//               // Customize the print window
//               $(win.document.body).addClass('white-bg'); // Add a class to the print window's body
//               $(win.document.body).css('font-size', '10px'); // Change font size for print
//               $(win.document.body).find('table').addClass('compact').css('font-size', 'inherit'); // Add a class to the table and restore font size
//           }
//       }
//   ]
//   });
// });
