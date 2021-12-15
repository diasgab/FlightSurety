
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

        let flightNames = ["ND001", "ND002", "ND003", "ND004", "ND005"];
        let flightKeys = contract.getFlightKeys();
          let flightsArray = [];
          flightKeys.then(result => {
            result.forEach((element, index) => {
              flightsArray.push({value: element, text: flightNames[index]});
              index++
            });

            populateFlightSelect(DOM.elid('buy-insurance-flight'), flightsArray)
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

          if (fromAirline == '' || airline == '') {
            alert("Complete the information: fromAirline and airline");
            return;
          }

          try {
            // Write transaction
            contract.registerAirline(fromAirline, airline, (error, result) => {
              if (error) {
                alert("ERROR: "+ error);
              } else {
                alert(`Airline added`);

                DOM.elid('new-airline').value = '';
                DOM.elid('from-airline').value = '';
              }
            });
          } catch (error) {

          }
        });

      DOM.elid('submit-airline-funds').addEventListener('click', async () => {
        let airlineAddress = DOM.elid('airline-address').value;
        let airlineFunds = DOM.elid('airline-funds').value;

        if (airlineAddress == '' || airlineFunds == '') {
          alert("Complete the information: address and amount");
          return;
        }

        if (airlineFunds < 10) {
          alert("10 ether is the min amount to fund an airline.");
          return;
        }

        try {
          // Write transaction
          contract.fundAirline(airlineAddress, airlineFunds, (error, result) => {
            if (error) {
              alert("ERROR: "+ error);
            } else {
              alert("Airline funded");

              DOM.elid('airline-address').value = '';
              DOM.elid('airline-funds').value = '';
            }
          });
        } catch (error) {
          alert("ERROR: "+ error);
        }
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
          alert("Insurance bought");
          DOM.elid("buy-insurance-passenger").value = '';
          DOM.elid("buy-insurance-amount").value = '';
        } catch (error) {
          alert("ERROR: "+ error);
        }
      });
    
    });

})();

function populateFlightSelect(select, options) {

  options.forEach((element, index) => {
    var opt = document.createElement("option");
    opt.value= element.value;
    opt.innerHTML = element.text; // whatever property it has

    // then append it to the select element
    select.appendChild(opt);
  });
}

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







