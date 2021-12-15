
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
        })

        DOM.elid('submit-airline').addEventListener('click', () => {
          let fromAirline = DOM.elid('from-airline').value;
          let airline = DOM.elid('new-airline').value;

          // Write transaction
          contract.registerAirline(fromAirline, airline, (error, result) => {
            if (error) {
              alert("ERROR: "+ error);
            } else {
              console.log(result);
              alert("Airline added");

              DOM.elid('new-airline').value = '';
              DOM.elid('from-airline').value = '';
            }
          });
        });

      DOM.elid('submit-airline-funds').addEventListener('click', async () => {
        let airlineAddress = DOM.elid('airline-address').value;
        let airlineFunds = DOM.elid('airline-funds').value;

        // Write transaction
        contract.fundAirline(airlineAddress, airlineFunds, (error, result) => {
          if (error) {
            alert("ERROR: "+ error);
          } else {
            console.log(result);
            alert("Airline funded");

            DOM.elid('airline-address').value = '';
            DOM.elid('airline-funds').value = '';
          }
        });
      });

      DOM.elid("submit-buy-insurance").addEventListener('click', async () => {
        let flight = DOM.elid("buy-insurance-flight").value;
        let passenger = DOM.elid("buy-insurance-passenger").value;
        let amount = DOM.elid("buy-insurance-amount").value;

        if (flight == '' || passenger == '' || amount == '') {
          alert("Complete the information: flight, passenger and amount");
          return;
        }

        let request = {
          flight: flight,
          amount: amount,
          from: passenger
        };

        if (amount <= 0 || amount > 1) {
          alert("Please enter amount up to 1 ether.");
          return;
        }

        try {
          await contract.buyInsurance(request);
          alert("Bought!");
          //let insurancesTableRows = DOM.elid("insurances-status-table-rows");
          //ui.updateInsurancesTable(contract, insurancesTableRows);
          //ui.showSuccessMessage("Insurance has been bought");
        } catch (e) {
          console.log(e);
          //ui.showErrorMessage(JSON.stringify(e, null, '\t'));
        }
      });
    
    });

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







