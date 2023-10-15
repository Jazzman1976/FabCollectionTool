namespace FabCollectionTool.Classes
{
    public class CardmarketWantsList
    {
        public List<CardmarketDecklistDto> CardmarketDecklistDtos { get; set; }

        /// <summary>
        /// reads the import result and creates cardmarket import rows DTOs
        /// </summary>
        public CardmarketWantsList(ImportResult importResult, string setname) 
        {
            CardmarketDecklistDtos = new List<CardmarketDecklistDto>();

            foreach (DataDto dataDto 
                in importResult.DataDtos
                    .Where(dto 
                        => dto.Set == setname 
                        || (dto.Id != null && dto.Id.StartsWith(setname.ToUpper()))))
            {
                // skip invalid dtos (e.g. category header rows)
                if (string.IsNullOrWhiteSpace(dataDto.Id) || dataDto.Id == "0")
                {
                    continue;
                }

                // get sum total
                int haveTotal = importResult.DataDtos
                    .Where(dto => dto.Name == dataDto.Name && dto.Pitch == dataDto.Pitch)
                    .Sum(dto => dto.ST + dto.RF + dto.CF + dto.GF);

                // is true, if more than one pitch value is found (Red, Yellow, Blue)
                // if only one (e.g. Blue) than this is false.
                // Cardmarket must not have the pitchvalue in the TXT when it has only one!
                bool hasPitch = importResult.DataDtos
                    .Where(dto => dto.Name == dataDto.Name)
                    .DistinctBy(dto => dto.Pitch)
                    .Count() > 1;
                
                // skip if playset reached (we only want missing cards)
                if (haveTotal >= dataDto.Playset)
                {
                    continue;
                }

                // add CardmarketDecklistDto to list
                var toAdd = new CardmarketDecklistDto
                {
                    Name = dataDto.Name,
                    BacksideName = dataDto.BacksideName,
                    Pitch = hasPitch ? dataDto.Pitch : null,
                    WantToBuy = dataDto.Playset - haveTotal,
                };

                // add if list doesn't have this, jet
                // could still have it, because there may be multiple art treatments in the .ods
                if (!CardmarketDecklistDtos
                    .Any(dto => dto.Name == toAdd.Name && dto.Pitch == toAdd.Pitch))
                {
                    CardmarketDecklistDtos.Add(toAdd);
                }

                // order list like cardmarket orders the list
                CardmarketDecklistDtos = CardmarketDecklistDtos.OrderBy(dto => dto.Name).ToList();
            }
        }
    }
}
